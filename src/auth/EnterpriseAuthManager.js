const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const EventEmitter = require('events');
const { Organization, User, AuditLog } = require('../database/enterprise-models');

class EnterpriseAuthManager extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();
    this.rateLimitMap = new Map();
  }

  // Advanced user registration with organization creation
  async registerOrganization(userData) {
    const {
      organizationName,
      domain,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      plan = 'starter'
    } = userData;

    // Validate inputs
    if (!this.isValidEmail(adminEmail)) {
      throw new Error('Invalid email format');
    }

    if (!this.isValidPassword(adminPassword)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number and special character');
    }

    // Check if organization domain already exists
    const existingOrg = await Organization.findOne({ where: { domain } });
    if (existingOrg) {
      throw new Error('Organization with this domain already exists');
    }

    // Check if admin email already exists
    const existingUser = await User.findOne({ where: { email: adminEmail.toLowerCase() } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    try {
      // Create organization
      const organization = await Organization.create({
        name: organizationName,
        domain: domain.toLowerCase(),
        subdomain: this.generateSubdomain(organizationName),
        plan,
        status: 'trial',
        settings: this.getDefaultSettings(plan)
      });

      // Create admin user
      const hashedPassword = await bcrypt.hash(adminPassword, 12);
      const apiKey = this.generateApiKey('org');

      const admin = await User.create({
        organizationId: organization.id,
        email: adminEmail.toLowerCase(),
        password: hashedPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        role: 'org_admin',
        permissions: this.getDefaultPermissions('org_admin'),
        apiKey,
        profile: {
          avatar: null,
          phone: null,
          timezone: 'UTC',
          language: 'en',
          notifications: {
            email: true,
            sms: false,
            push: true
          }
        }
      });

      // Log the registration
      await this.logAudit({
        organizationId: organization.id,
        userId: admin.id,
        action: 'organization.created',
        resource: 'organization',
        resourceId: organization.id
      });

      this.emit('organizationRegistered', { organization, admin });

      return {
        organization: organization.toJSON(),
        admin: this.sanitizeUser(admin.toJSON())
      };
    } catch (error) {
      console.error('Organization registration error:', error);
      throw new Error('Failed to create organization');
    }
  }

  // Enhanced user authentication with rate limiting and 2FA
  async authenticateUser(email, password, twoFactorToken = null, metadata = {}) {
    // Rate limiting check
    if (this.isRateLimited(email)) {
      throw new Error('Too many login attempts. Please try again later.');
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase() },
      include: [{
        model: Organization,
        as: 'organization'
      }]
    });

    if (!user) {
      this.recordFailedAttempt(email);
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is inactive');
    }

    if (!user.organization.isActive) {
      throw new Error('Organization is suspended');
    }

    // Check trial expiration
    if (user.organization.status === 'trial' && user.organization.trialEndsAt < new Date()) {
      throw new Error('Trial period has expired');
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      this.recordFailedAttempt(email);
      throw new Error('Invalid credentials');
    }

    // Two-factor authentication check
    if (user.twoFactorEnabled) {
      if (!twoFactorToken) {
        throw new Error('Two-factor authentication token required');
      }

      const verified = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: 'base32',
        token: twoFactorToken,
        window: 2
      });

      if (!verified) {
        this.recordFailedAttempt(email);
        throw new Error('Invalid two-factor authentication token');
      }
    }

    // Update user login information
    await user.update({
      lastLoginAt: new Date(),
      lastActiveAt: new Date()
    });

    // Generate session token
    const sessionToken = this.generateSessionToken(user);
    const sessionData = {
      id: crypto.randomUUID(),
      userId: user.id,
      organizationId: user.organizationId,
      token: sessionToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      metadata
    };

    this.activeSessions.set(sessionData.id, sessionData);
    this.clearFailedAttempts(email);

    // Log successful login
    await this.logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'user.login',
      resource: 'user',
      resourceId: user.id,
      metadata
    });

    this.emit('userLoggedIn', { user, session: sessionData });

    return {
      user: this.sanitizeUser(user.toJSON()),
      organization: user.organization.toJSON(),
      token: sessionToken,
      expiresAt: sessionData.expiresAt
    };
  }

  // Two-factor authentication setup
  async setupTwoFactor(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const secret = speakeasy.generateSecret({
      name: `Deepgram AI Platform (${user.email})`,
      issuer: 'Deepgram AI Platform'
    });

    // Store the secret temporarily (not enabled until verified)
    await user.update({
      twoFactorSecret: secret.base32
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntryCode: secret.base32
    };
  }

  // Verify and enable two-factor authentication
  async enableTwoFactor(userId, token) {
    const user = await User.findByPk(userId);
    if (!user || !user.twoFactorSecret) {
      throw new Error('Two-factor setup not initiated');
    }

    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 2
    });

    if (!verified) {
      throw new Error('Invalid authentication code');
    }

    await user.update({
      twoFactorEnabled: true
    });

    await this.logAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: 'user.2fa_enabled',
      resource: 'user',
      resourceId: user.id
    });

    return { success: true };
  }

  // Advanced token verification with session management
  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret');
      
      // Find active session
      let session = null;
      for (const [sessionId, sessionData] of this.activeSessions) {
        if (sessionData.token === token && sessionData.userId === decoded.userId) {
          session = sessionData;
          break;
        }
      }

      if (!session || session.expiresAt < new Date()) {
        return null;
      }

      const user = await User.findByPk(decoded.userId, {
        include: [{
          model: Organization,
          as: 'organization'
        }]
      });

      if (!user || !user.isActive || !user.organization.isActive) {
        return null;
      }

      // Update last active time
      await user.update({ lastActiveAt: new Date() });

      return {
        user: this.sanitizeUser(user.toJSON()),
        organization: user.organization.toJSON(),
        session
      };
    } catch (error) {
      return null;
    }
  }

  // Create user within organization
  async createUser(userData, createdBy) {
    const {
      email,
      password,
      firstName,
      lastName,
      role = 'viewer',
      permissions = []
    } = userData;

    // Validate permissions
    if (!this.hasPermission(createdBy, 'users:create')) {
      throw new Error('Insufficient permissions to create users');
    }

    // Check organization limits
    const organization = await Organization.findByPk(createdBy.organizationId);
    const userCount = await User.count({ where: { organizationId: createdBy.organizationId } });
    
    if (organization.settings.features.maxUsers !== -1 && userCount >= organization.settings.features.maxUsers) {
      throw new Error('Organization user limit reached');
    }

    // Validate inputs
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    if (!this.isValidPassword(password)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number and special character');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = this.generateApiKey('user');

    const user = await User.create({
      organizationId: createdBy.organizationId,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role,
      permissions: permissions.length > 0 ? permissions : this.getDefaultPermissions(role),
      apiKey
    });

    // Log user creation
    await this.logAudit({
      organizationId: createdBy.organizationId,
      userId: createdBy.id,
      action: 'user.created',
      resource: 'user',
      resourceId: user.id,
      changes: { email, role, permissions }
    });

    this.emit('userCreated', { user, createdBy });

    return this.sanitizeUser(user.toJSON());
  }

  // Utility methods
  generateSubdomain(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 20) + '-' + crypto.randomBytes(4).toString('hex');
  }

  generateApiKey(prefix = 'api') {
    return `${prefix}_${crypto.randomBytes(32).toString('hex')}`;
  }

  generateSessionToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        organizationId: user.organizationId,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-jwt-secret',
      { expiresIn: '24h' }
    );
  }

  getDefaultSettings(plan) {
    const planSettings = {
      starter: {
        features: {
          maxAgents: 5,
          maxUsers: 10,
          maxCallMinutes: 1000,
          advancedAnalytics: false,
          customBranding: false,
          apiAccess: false,
          webhooks: false,
          sso: false
        }
      },
      professional: {
        features: {
          maxAgents: 25,
          maxUsers: 50,
          maxCallMinutes: 5000,
          advancedAnalytics: true,
          customBranding: true,
          apiAccess: true,
          webhooks: true,
          sso: false
        }
      },
      enterprise: {
        features: {
          maxAgents: 100,
          maxUsers: 200,
          maxCallMinutes: 20000,
          advancedAnalytics: true,
          customBranding: true,
          apiAccess: true,
          webhooks: true,
          sso: true
        }
      },
      'enterprise-plus': {
        features: {
          maxAgents: -1,
          maxUsers: -1,
          maxCallMinutes: -1,
          advancedAnalytics: true,
          customBranding: true,
          apiAccess: true,
          webhooks: true,
          sso: true
        }
      }
    };

    return {
      ...planSettings[plan],
      branding: {
        logo: null,
        primaryColor: '#3498db',
        secondaryColor: '#2c3e50'
      },
      integrations: {
        crm: null,
        helpdesk: null,
        analytics: null
      }
    };
  }

  getDefaultPermissions(role) {
    const rolePermissions = {
      super_admin: ['*'],
      org_admin: [
        'users:*', 'agents:*', 'calls:*', 'analytics:*', 
        'integrations:*', 'billing:*', 'settings:*'
      ],
      manager: [
        'users:read', 'users:create', 'agents:*', 'calls:*', 
        'analytics:read', 'integrations:read'
      ],
      agent_creator: [
        'agents:*', 'calls:read', 'analytics:read'
      ],
      viewer: [
        'calls:read', 'analytics:read', 'profile:*'
      ]
    };

    return rolePermissions[role] || rolePermissions.viewer;
  }

  hasPermission(user, permission) {
    if (!user || !user.permissions) return false;
    
    // Super admin has all permissions
    if (user.permissions.includes('*')) return true;
    
    // Check exact permission
    if (user.permissions.includes(permission)) return true;
    
    // Check wildcard permissions
    const [resource, action] = permission.split(':');
    return user.permissions.includes(`${resource}:*`);
  }

  // Rate limiting
  isRateLimited(email) {
    const key = `login_${email}`;
    const attempts = this.rateLimitMap.get(key) || { count: 0, lastAttempt: null };
    
    // Reset if more than 15 minutes passed
    if (attempts.lastAttempt && Date.now() - attempts.lastAttempt > 15 * 60 * 1000) {
      this.rateLimitMap.delete(key);
      return false;
    }
    
    return attempts.count >= 5;
  }

  recordFailedAttempt(email) {
    const key = `login_${email}`;
    const attempts = this.rateLimitMap.get(key) || { count: 0, lastAttempt: null };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.rateLimitMap.set(key, attempts);
  }

  clearFailedAttempts(email) {
    const key = `login_${email}`;
    this.rateLimitMap.delete(key);
  }

  // Audit logging
  async logAudit(data) {
    try {
      await AuditLog.create({
        organizationId: data.organizationId,
        userId: data.userId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        changes: data.changes,
        metadata: {
          ...data.metadata,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Audit logging error:', error);
    }
  }

  // Utility functions
  sanitizeUser(user) {
    const { password, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  isValidPassword(password) {
    // At least 8 characters, 1 uppercase, 1 lowercase, 1 number, 1 special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
    return passwordRegex.test(password);
  }

  // Session management
  async logout(token) {
    for (const [sessionId, session] of this.activeSessions) {
      if (session.token === token) {
        this.activeSessions.delete(sessionId);
        
        // Log logout
        await this.logAudit({
          organizationId: session.organizationId,
          userId: session.userId,
          action: 'user.logout',
          resource: 'user',
          resourceId: session.userId
        });
        
        this.emit('userLoggedOut', session);
        return true;
      }
    }
    return false;
  }

  cleanupExpiredSessions() {
    const now = new Date();
    for (const [sessionId, session] of this.activeSessions) {
      if (session.expiresAt < now) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  // Run cleanup every 5 minutes
  startSessionCleanup() {
    setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
  }
}

module.exports = EnterpriseAuthManager;

