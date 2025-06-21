const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const EventEmitter = require('events');

class AuthManager extends EventEmitter {
  constructor() {
    super();
    this.users = new Map();
    this.sessions = new Map();
    this.passwordResetTokens = new Map();
    this.emailVerificationTokens = new Map();
    this.createDefaultAdmin();
  }

  async createDefaultAdmin() {
    // Create default admin user if it doesn't exist
    const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@deepgram-ai.com';
    const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123!@#';
    
    if (!this.getUserByEmail(adminEmail)) {
      await this.createUser({
        email: adminEmail,
        password: adminPassword,
        firstName: 'System',
        lastName: 'Administrator',
        role: 'super_admin',
        emailVerified: true,
        status: 'active'
      });
      console.log(`🔑 Default admin created: ${adminEmail}`);
    }
  }

  async createUser(userData) {
    const {
      email,
      password,
      firstName,
      lastName,
      role = 'user',
      companyName,
      phone,
      emailVerified = false
    } = userData;

    // Validate email format
    if (!this.isValidEmail(email)) {
      throw new Error('Invalid email format');
    }

    // Check if user already exists
    if (this.getUserByEmail(email)) {
      throw new Error('User with this email already exists');
    }

    // Validate password strength
    if (!this.isValidPassword(password)) {
      throw new Error('Password must be at least 8 characters with uppercase, lowercase, number and special character');
    }

    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = this.generateApiKey();
    const secretKey = this.generateSecretKey();

    const user = {
      id: userId,
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      role, // 'super_admin', 'admin', 'reseller', 'user'
      companyName,
      phone,
      apiKey,
      secretKey,
      emailVerified,
      status: 'active', // 'active', 'inactive', 'suspended', 'pending'
      subscription: {
        tier: role === 'reseller' ? 'reseller' : 'starter',
        status: 'active',
        startDate: new Date(),
        nextBillingDate: this.getNextBillingDate()
      },
      settings: {
        twoFactorEnabled: false,
        emailNotifications: true,
        smsNotifications: false,
        timezone: 'UTC'
      },
      metadata: {
        lastLogin: null,
        loginCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: userData.createdBy || 'system'
      },
      permissions: this.getDefaultPermissions(role)
    };

    this.users.set(userId, user);

    // Generate email verification token if needed
    if (!emailVerified) {
      const verificationToken = this.generateEmailVerificationToken(userId);
      this.emit('userRegistered', { user, verificationToken });
    }

    this.emit('userCreated', user);
    return { ...user, password: undefined }; // Don't return password
  }

  async authenticateUser(email, password) {
    const user = this.getUserByEmail(email);
    
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (user.status !== 'active') {
      throw new Error(`Account is ${user.status}`);
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update login metadata
    user.metadata.lastLogin = new Date();
    user.metadata.loginCount++;
    this.users.set(user.id, user);

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
      user: { ...user, password: undefined },
      token: sessionToken,
      expiresAt: session.expiresAt
    };
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const user = this.users.get(decoded.userId);
      
      if (!user || user.status !== 'active') {
        return null;
      }

      return { ...user, password: undefined };
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

  getUserByEmail(email) {
    for (const user of this.users.values()) {
      if (user.email === email.toLowerCase()) {
        return user;
      }
    }
    return null;
  }

  getUserById(userId) {
    return this.users.get(userId);
  }

  getAllUsers(filters = {}) {
    let users = Array.from(this.users.values());

    if (filters.role) {
      users = users.filter(user => user.role === filters.role);
    }

    if (filters.status) {
      users = users.filter(user => user.status === filters.status);
    }

    if (filters.emailVerified !== undefined) {
      users = users.filter(user => user.emailVerified === filters.emailVerified);
    }

    return users.map(user => ({ ...user, password: undefined }));
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
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
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

