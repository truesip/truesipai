const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const cron = require('node-cron');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { createClient } = require('@deepgram/sdk');
const WebSocket = require('ws');
const path = require('path');
const OpenAI = require('openai');
const Stripe = require('stripe');
require('dotenv').config();

// Import enterprise components
const EnterpriseAuthManager = require('./src/auth/EnterpriseAuthManager');
const { initEnterpriseDatabase, Organization, User, AIAgent, Call, Analytics, Integration, AuditLog, BillingRecord } = require('./src/database/enterprise-models');

// Setup enterprise logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'deepgram-ai-enterprise' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Enterprise middleware stack
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Enterprise rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: (req) => {
    // Different limits based on plan
    if (req.user?.organization?.plan === 'enterprise-plus') return 1000;
    if (req.user?.organization?.plan === 'enterprise') return 500;
    if (req.user?.organization?.plan === 'professional') return 200;
    return 100; // starter
  },
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Initialize enterprise services
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const authManager = new EnterpriseAuthManager();

// Start session cleanup
authManager.startSessionCleanup();

// Enterprise middleware for authentication and organization context
const authenticateEnterprise = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const authResult = await authManager.verifyToken(token);
    if (!authResult) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = authResult.user;
    req.organization = authResult.organization;
    req.session = authResult.session;
    
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

// Permissions middleware
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!authManager.hasPermission(req.user, permission)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Usage tracking middleware
const trackUsage = async (req, res, next) => {
  try {
    if (req.organization && req.user) {
      // Track API usage
      const organization = await Organization.findByPk(req.organization.id);
      if (organization) {
        const usage = organization.usage || {};
        usage.lastApiCall = new Date();
        await organization.update({ usage });
      }
    }
    next();
  } catch (error) {
    logger.error('Usage tracking error:', error);
    next();
  }
};

// Store active calls with enterprise features
const activeCalls = new Map();

// Enterprise AI configuration
const ENTERPRISE_AI_CONFIG = {
  voice: 'aura-odysseus-en',
  greeting: 'Hello! Thank you for calling. I\'m your AI assistant. How can I help you today?',
  prompt: `You are a professional AI phone assistant for an enterprise organization.
  - Be helpful, polite, and concise
  - Listen carefully to customer needs
  - Provide clear and accurate information
  - If you don't know something, say so honestly
  - Always maintain a professional tone
  - Keep responses under 30 seconds when possible
  - Log all interactions for compliance`,
  maxCallDuration: 1800, // 30 minutes for enterprise
  enableRecording: true,
  enableTranscription: true,
  enableSentimentAnalysis: true,
  enableCompliance: true
};

// Health check with enterprise metrics
app.get('/health', async (req, res) => {
  try {
    const metrics = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0-enterprise',
      database: 'connected',
      activeCalls: activeCalls.size,
      activeOrganizations: await Organization.count({ where: { isActive: true } }),
      totalUsers: await User.count({ where: { isActive: true } }),
      totalAgents: await AIAgent.count({ where: { isActive: true } })
    };
    
    res.json(metrics);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Enterprise authentication endpoints
app.post('/auth/register-organization', async (req, res) => {
  try {
    const result = await authManager.registerOrganization(req.body);
    
    logger.info('Organization registered', {
      organizationId: result.organization.id,
      domain: result.organization.domain
    });
    
    res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      ...result
    });
  } catch (error) {
    logger.error('Organization registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password, twoFactorToken } = req.body;
    const metadata = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    };
    
    const result = await authManager.authenticateUser(email, password, twoFactorToken, metadata);
    
    logger.info('User login successful', {
      userId: result.user.id,
      organizationId: result.organization.id,
      email: result.user.email
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      ...result
    });
  } catch (error) {
    logger.warn('Login attempt failed', { email: req.body.email, error: error.message });
    res.status(401).json({ error: error.message });
  }
});

app.post('/auth/setup-2fa', authenticateEnterprise, async (req, res) => {
  try {
    const result = await authManager.setupTwoFactor(req.user.id);
    res.json({ success: true, ...result });
  } catch (error) {
    logger.error('2FA setup error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/enable-2fa', authenticateEnterprise, async (req, res) => {
  try {
    const { token } = req.body;
    const result = await authManager.enableTwoFactor(req.user.id, token);
    
    logger.info('2FA enabled for user', { userId: req.user.id });
    res.json(result);
  } catch (error) {
    logger.error('2FA enable error:', error);
    res.status(400).json({ error: error.message });
  }
});

app.post('/auth/logout', authenticateEnterprise, async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    await authManager.logout(token);
    
    logger.info('User logout', { userId: req.user.id });
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Enterprise organization management
app.get('/api/organization', authenticateEnterprise, requirePermission('organization:read'), async (req, res) => {
  try {
    const organization = await Organization.findByPk(req.organization.id, {
      include: [
        { model: User, as: 'users', attributes: { exclude: ['password'] } },
        { model: AIAgent, as: 'agents' },
        { model: Integration, as: 'integrations' }
      ]
    });
    
    res.json({ organization });
  } catch (error) {
    logger.error('Organization fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

app.put('/api/organization', authenticateEnterprise, requirePermission('organization:write'), async (req, res) => {
  try {
    const { name, settings } = req.body;
    
    const organization = await Organization.findByPk(req.organization.id);
    await organization.update({ name, settings });
    
    // Log the change
    await authManager.logAudit({
      organizationId: req.organization.id,
      userId: req.user.id,
      action: 'organization.updated',
      resource: 'organization',
      resourceId: organization.id,
      changes: { name, settings }
    });
    
    logger.info('Organization updated', { organizationId: organization.id });
    res.json({ success: true, organization });
  } catch (error) {
    logger.error('Organization update error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Enterprise user management
app.get('/api/users', authenticateEnterprise, requirePermission('users:read'), trackUsage, async (req, res) => {
  try {
    const users = await User.findAll({
      where: { organizationId: req.organization.id },
      attributes: { exclude: ['password', 'twoFactorSecret'] },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ users });
  } catch (error) {
    logger.error('Users fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/users', authenticateEnterprise, requirePermission('users:create'), async (req, res) => {
  try {
    const user = await authManager.createUser(req.body, req.user);
    
    logger.info('User created', { userId: user.id, createdBy: req.user.id });
    res.status(201).json({ success: true, user });
  } catch (error) {
    logger.error('User creation error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Enterprise AI agent management with advanced features
app.get('/api/agents', authenticateEnterprise, requirePermission('agents:read'), trackUsage, async (req, res) => {
  try {
    const agents = await AIAgent.findAll({
      where: { organizationId: req.organization.id },
      include: [{ model: User, as: 'creator', attributes: ['firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ agents });
  } catch (error) {
    logger.error('Agents fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

app.post('/api/agents', authenticateEnterprise, requirePermission('agents:create'), async (req, res) => {
  try {
    // Check organization limits
    const agentCount = await AIAgent.count({ where: { organizationId: req.organization.id } });
    const maxAgents = req.organization.settings.features.maxAgents;
    
    if (maxAgents !== -1 && agentCount >= maxAgents) {
      return res.status(403).json({ error: 'Agent limit reached for your plan' });
    }
    
    const agentData = {
      ...req.body,
      organizationId: req.organization.id,
      createdBy: req.user.id
    };
    
    const agent = await AIAgent.create(agentData);
    
    // Log agent creation
    await authManager.logAudit({
      organizationId: req.organization.id,
      userId: req.user.id,
      action: 'agent.created',
      resource: 'agent',
      resourceId: agent.id,
      changes: agentData
    });
    
    logger.info('AI Agent created', { agentId: agent.id, createdBy: req.user.id });
    res.status(201).json({ success: true, agent });
  } catch (error) {
    logger.error('Agent creation error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Enterprise call handling with enhanced tracking
app.post('/webhook/call', async (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const from = req.body.From;
  const to = req.body.To;
  
  logger.info('Incoming call', { callSid, from, to });
  
  try {
    // Find the organization based on the phone number
    // This would need to be configured in your system
    const organization = await Organization.findOne({
      where: { 
        // You'd need to configure phone number mapping
        isActive: true 
      }
    });
    
    if (!organization) {
      logger.warn('No organization found for phone number', { to });
      twiml.say('Sorry, this service is currently unavailable.');
      return res.type('text/xml').send(twiml.toString());
    }
    
    // Store call information with enterprise tracking
    const callData = {
      organizationId: organization.id,
      callSid,
      fromNumber: from,
      toNumber: to,
      direction: 'inbound',
      status: 'ringing',
      startTime: new Date(),
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip
      }
    };
    
    // Save to database
    await Call.create(callData);
    
    // Store in active calls
    activeCalls.set(callSid, {
      ...callData,
      config: ENTERPRISE_AI_CONFIG
    });
    
    // Connect to WebSocket for real-time audio processing
    const connect = twiml.connect();
    connect.stream({
      url: `wss://${req.get('host')}/stream/${callSid}`,
      track: 'both_tracks'
    });
    
    res.type('text/xml').send(twiml.toString());
  } catch (error) {
    logger.error('Webhook call error:', error);
    twiml.say('Sorry, there was an error processing your call.');
    res.type('text/xml').send(twiml.toString());
  }
});

// Enterprise analytics and reporting
app.get('/api/analytics', authenticateEnterprise, requirePermission('analytics:read'), async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;
    
    const analytics = await Analytics.findAll({
      where: {
        organizationId: req.organization.id,
        type: period,
        ...(startDate && endDate && {
          createdAt: {
            [require('sequelize').Op.between]: [new Date(startDate), new Date(endDate)]
          }
        })
      },
      order: [['createdAt', 'DESC']],
      limit: 100
    });
    
    res.json({ analytics });
  } catch (error) {
    logger.error('Analytics fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Enterprise billing endpoints
app.get('/api/billing', authenticateEnterprise, requirePermission('billing:read'), async (req, res) => {
  try {
    const billingRecords = await BillingRecord.findAll({
      where: { organizationId: req.organization.id },
      order: [['createdAt', 'DESC']],
      limit: 50
    });
    
    res.json({ billingRecords });
  } catch (error) {
    logger.error('Billing fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch billing information' });
  }
});

// Enterprise audit logs
app.get('/api/audit', authenticateEnterprise, requirePermission('audit:read'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const auditLogs = await AuditLog.findAndCountAll({
      where: { organizationId: req.organization.id },
      include: [{ model: User, as: 'user', attributes: ['firstName', 'lastName', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    res.json({
      auditLogs: auditLogs.rows,
      pagination: {
        total: auditLogs.count,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(auditLogs.count / limit)
      }
    });
  } catch (error) {
    logger.error('Audit logs fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// Serve enterprise dashboard
app.use('/enterprise', express.static(path.join(__dirname, 'public/enterprise')));
app.use('/dashboard', express.static(path.join(__dirname, 'public/dashboard')));
app.use('/agent-creator', express.static(path.join(__dirname, 'public/agent-creator')));
app.use('/login', express.static(path.join(__dirname, 'public/login')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Deepgram AI Phone Platform - Enterprise Edition',
    version: '2.0.0-enterprise',
    description: 'Enterprise-grade AI phone platform with multi-tenant architecture',
    features: [
      'Multi-tenant Organizations',
      'Advanced User Management',
      'Role-based Access Control',
      'Two-Factor Authentication',
      'Audit Logging & Compliance',
      'Advanced Analytics',
      'Enterprise Integrations',
      'Custom Branding',
      'API Rate Limiting',
      'Billing & Usage Tracking'
    ],
    endpoints: {
      authentication: {
        'POST /auth/register-organization': 'Register new organization',
        'POST /auth/login': 'User login with 2FA support',
        'POST /auth/setup-2fa': 'Setup two-factor authentication',
        'POST /auth/logout': 'User logout'
      },
      organization: {
        'GET /api/organization': 'Get organization details',
        'PUT /api/organization': 'Update organization settings'
      },
      users: {
        'GET /api/users': 'List organization users',
        'POST /api/users': 'Create new user',
        'PUT /api/users/:id': 'Update user',
        'DELETE /api/users/:id': 'Delete user'
      },
      agents: {
        'GET /api/agents': 'List AI agents',
        'POST /api/agents': 'Create AI agent',
        'PUT /api/agents/:id': 'Update AI agent',
        'DELETE /api/agents/:id': 'Delete AI agent'
      },
      analytics: {
        'GET /api/analytics': 'Get analytics data',
        'GET /api/calls': 'Get call history',
        'GET /api/audit': 'Get audit logs'
      },
      billing: {
        'GET /api/billing': 'Get billing information',
        'POST /api/billing/subscription': 'Manage subscription'
      }
    }
  });
});

// Enterprise scheduled tasks
cron.schedule('0 0 * * *', async () => {
  logger.info('Running daily analytics aggregation');
  // Add your analytics aggregation logic here
});

cron.schedule('0 */6 * * *', async () => {
  logger.info('Running session cleanup');
  authManager.cleanupExpiredSessions();
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;

// Initialize enterprise application
async function startEnterpriseApp() {
  try {
    logger.info('Initializing enterprise database...');
    await initEnterpriseDatabase();
    
    logger.info('Starting enterprise server...');
    server.listen(PORT, () => {
      logger.info(`🏢 Deepgram AI Enterprise Platform running on port ${PORT}`);
      logger.info(`📊 Version: 2.0.0-enterprise`);
      logger.info(`🔒 Security: Multi-tenant with enterprise features`);
      logger.info(`📞 Webhook: http://localhost:${PORT}/webhook/call`);
      logger.info(`🌐 API Docs: http://localhost:${PORT}/api`);
      logger.info(`🔑 Admin Registration: http://localhost:${PORT}/auth/register-organization`);
    });
  } catch (error) {
    logger.error('Failed to start enterprise application:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
  });
});

startEnterpriseApp();

module.exports = app;

