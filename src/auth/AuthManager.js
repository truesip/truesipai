const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const EventEmitter = require('events');
const { User } = require('../database/models');

class AuthManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.passwordResetTokens = new Map();
    this.emailVerificationTokens = new Map();
  }

  async createDefaultAdmin() {
    // Create default admin user if it doesn't exist
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@deepgram-ai.com';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'Admin123!@#';
    
    try {
      const existingAdmin = await User.findOne({ where: { email: adminEmail } });
      if (!existingAdmin) {
        await this.createUser({
          email: adminEmail,
          password: adminPassword,
          firstName: 'System',
          lastName: 'Administrator',
          role: 'admin',
          company: 'Deepgram AI Platform',
          subscription: 'enterprise',
          subscriptionStatus: 'active',
          minutesLimit: -1 // unlimited
        });
        console.log(`🔑 Default admin created: ${adminEmail}`);
      }
    } catch (error) {
      console.error('Error creating default admin:', error);
    }
  }

  async createUser(userData) {
    const {
      email,
      password,
      firstName,
      lastName,
      role = 'user',
      company,
      subscription = 'starter',
      subscriptionStatus = 'active',
      minutesLimit = 100
    } = userData;

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (!this.isValidPassword(password)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number and special character (@$!%*?&#)');
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = this.generateApiKey();

    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      company,
      role,
      subscription,
      subscriptionStatus,
      apiKey,
      minutesLimit,
      isActive: true
    });

    this.emit('userCreated', user);
    return user.toJSON();
  }

  async authenticateUser(email, password) {
    try {
      console.log(`Authentication attempt for email: ${email}`);
      
      const user = await User.findOne({ where: { email: email.toLowerCase() } });
      
      if (!user) {
        console.log(`User not found for email: ${email}`);
        throw new Error('Invalid credentials');
      }

      console.log(`User found: ${user.email}, isActive: ${user.isActive}`);
      
      if (!user.isActive) {
        console.log(`Account inactive for user: ${user.email}`);
        throw new Error('Account is inactive');
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      console.log(`Password validation result for ${user.email}: ${isValidPassword}`);
      
      if (!isValidPassword) {
        console.log(`Invalid password for user: ${user.email}`);
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      console.error(`Authentication error for ${email}:`, error.message);
      throw error;
    }

    // Generate session token
    const sessionToken = this.generateSessionToken(user);
    const session = {
      id: uuidv4(),
      userId: user.id,
      token: sessionToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      userAgent: null,
      ipAddress: null
    };

    this.sessions.set(session.id, session);
    this.emit('userLoggedIn', { user, session });

    return {
      user: user.toJSON(),
      token: sessionToken,
      expiresAt: session.expiresAt
    };
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = await User.findByPk(decoded.userId);
      
      if (!user || !user.isActive) {
        return null;
      }

      return user.toJSON();
    } catch (error) {
      return null;
    }
  }

  generateSessionToken(user) {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );
  }

  generateApiKey() {
    return 'dk_' + crypto.randomBytes(32).toString('hex');
  }

  generateSecretKey() {
    return crypto.randomBytes(64).toString('hex');
  }

  generateEmailVerificationToken(userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    
    this.emailVerificationTokens.set(token, {
      userId,
      expiresAt: expiry
    });

    return token;
  }

  async verifyEmail(token) {
    const tokenData = this.emailVerificationTokens.get(token);
    
    if (!tokenData || tokenData.expiresAt < new Date()) {
      throw new Error('Invalid or expired verification token');
    }

    const user = this.users.get(tokenData.userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.emailVerified = true;
    user.metadata.updatedAt = new Date();
    this.users.set(user.id, user);
    this.emailVerificationTokens.delete(token);

    this.emit('emailVerified', user);
    return true;
  }

  generatePasswordResetToken(email) {
    const user = this.getUserByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    this.passwordResetTokens.set(token, {
      userId: user.id,
      expiresAt: expiry
    });

    this.emit('passwordResetRequested', { user, token });
    return token;
  }

  async resetPassword(token, newPassword) {
    const tokenData = this.passwordResetTokens.get(token);
    
    if (!tokenData || tokenData.expiresAt < new Date()) {
      throw new Error('Invalid or expired reset token');
    }

    if (!this.isValidPassword(newPassword)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number and special character');
    }

    const user = this.users.get(tokenData.userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.password = await bcrypt.hash(newPassword, 12);
    user.metadata.updatedAt = new Date();
    this.users.set(user.id, user);
    this.passwordResetTokens.delete(token);

    this.emit('passwordReset', user);
    return true;
  }

  async getUserByEmail(email) {
    const user = await User.findOne({ where: { email: email.toLowerCase() } });
    return user ? user.toJSON() : null;
  }

  async getUserById(userId) {
    const user = await User.findByPk(userId);
    return user ? user.toJSON() : null;
  }

  async getAllUsers(filters = {}) {
    const whereClause = {};

    if (filters.role) {
      whereClause.role = filters.role;
    }

    if (filters.subscriptionStatus) {
      whereClause.subscriptionStatus = filters.subscriptionStatus;
    }

    if (filters.isActive !== undefined) {
      whereClause.isActive = filters.isActive;
    }

    const users = await User.findAll({ 
      where: whereClause,
      attributes: { exclude: ['password'] } // Don't return passwords
    });
    
    return users.map(user => user.toJSON());
  }

  updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Don't allow direct password updates (use resetPassword instead)
    delete updates.password;
    delete updates.id;

    Object.assign(user, updates, {
      metadata: {
        ...user.metadata,
        updatedAt: new Date()
      }
    });

    this.users.set(userId, user);
    this.emit('userUpdated', user);
    return { ...user, password: undefined };
  }

  deleteUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    this.users.delete(userId);
    this.emit('userDeleted', user);
    return true;
  }

  suspendUser(userId, reason) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.status = 'suspended';
    user.metadata.suspendedAt = new Date();
    user.metadata.suspensionReason = reason;
    user.metadata.updatedAt = new Date();

    this.users.set(userId, user);
    this.emit('userSuspended', { user, reason });
    return { ...user, password: undefined };
  }

  reactivateUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.status = 'active';
    delete user.metadata.suspendedAt;
    delete user.metadata.suspensionReason;
    user.metadata.updatedAt = new Date();

    this.users.set(userId, user);
    this.emit('userReactivated', user);
    return { ...user, password: undefined };
  }

  getDefaultPermissions(role) {
    const permissions = {
      super_admin: [
        'users:read', 'users:write', 'users:delete',
        'system:read', 'system:write', 'system:configure',
        'billing:read', 'billing:write',
        'analytics:read', 'analytics:export',
        'calls:read', 'calls:write', 'calls:delete'
      ],
      admin: [
        'users:read', 'users:write',
        'billing:read',
        'analytics:read',
        'calls:read', 'calls:write'
      ],
      reseller: [
        'customers:read', 'customers:write',
        'billing:read',
        'analytics:read',
        'calls:read'
      ],
      user: [
        'profile:read', 'profile:write',
        'calls:read', 'calls:write',
        'agents:read', 'agents:write'
      ]
    };

    return permissions[role] || permissions.user;
  }

  hasPermission(user, permission) {
    return user.permissions.includes(permission);
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

  getNextBillingDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  logout(token) {
    // Find and remove session
    for (const [sessionId, session] of this.sessions) {
      if (session.token === token) {
        this.sessions.delete(sessionId);
        this.emit('userLoggedOut', session);
        return true;
      }
    }
    return false;
  }

  cleanupExpiredSessions() {
    const now = new Date();
    for (const [sessionId, session] of this.sessions) {
      if (session.expiresAt < now) {
        this.sessions.delete(sessionId);
      }
    }
  }

  getActiveSessionsCount(userId) {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.expiresAt > new Date()) {
        count++;
      }
    }
    return count;
  }

  getUserStats() {
    const users = Array.from(this.users.values());
    return {
      total: users.length,
      active: users.filter(u => u.status === 'active').length,
      suspended: users.filter(u => u.status === 'suspended').length,
      pending: users.filter(u => u.status === 'pending').length,
      verified: users.filter(u => u.emailVerified).length,
      unverified: users.filter(u => !u.emailVerified).length,
      byRole: {
        super_admin: users.filter(u => u.role === 'super_admin').length,
        admin: users.filter(u => u.role === 'admin').length,
        reseller: users.filter(u => u.role === 'reseller').length,
        user: users.filter(u => u.role === 'user').length
      }
    };
  }
}

module.exports = AuthManager;

