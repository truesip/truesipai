// Authentication middleware for protecting routes

function authenticateToken(authManager) {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const user = authManager.verifyToken(token);
    if (!user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  };
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = Array.isArray(roles) ? roles : [roles];
    if (!userRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: userRoles,
        current: req.user.role
      });
    }

    next();
  };
}

function requirePermission(authManager, permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!authManager.hasPermission(req.user, permission)) {
      return res.status(403).json({ 
        error: 'Permission denied',
        required: permission
      });
    }

    next();
  };
}

function requireEmailVerification() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.emailVerified) {
      return res.status(403).json({ 
        error: 'Email verification required',
        message: 'Please verify your email address to access this resource'
      });
    }

    next();
  };
}

function rateLimitByUser(windowMs = 15 * 60 * 1000, maxRequests = 100) {
  const userRequests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId).filter(time => time > windowStart);
      userRequests.set(userId, requests);
    }

    const userRequestCount = userRequests.get(userId)?.length || 0;

    if (userRequestCount >= maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: `Maximum ${maxRequests} requests per ${windowMs / 1000} seconds`
      });
    }

    // Add current request
    const requests = userRequests.get(userId) || [];
    requests.push(now);
    userRequests.set(userId, requests);

    next();
  };
}

function validateApiKey(authManager) {
  return (req, res, next) => {
    const apiKey = req.headers['x-api-key'] || req.query.api_key;
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key required' });
    }

    // Try to find user by API key
    let foundUser = null;
    for (const user of authManager.users.values()) {
      if (user.apiKey === apiKey && user.status === 'active') {
        foundUser = { ...user, password: undefined };
        break;
      }
    }

    if (!foundUser) {
      return res.status(403).json({ error: 'Invalid API key' });
    }

    req.user = foundUser;
    req.authMethod = 'api_key';
    next();
  };
}

function requireActiveSubscription() {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.subscription.status !== 'active') {
      return res.status(403).json({ 
        error: 'Active subscription required',
        subscriptionStatus: req.user.subscription.status
      });
    }

    next();
  };
}

function logRequest() {
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - User: ${req.user?.email || 'Anonymous'}`);
    });

    next();
  };
}

module.exports = {
  authenticateToken,
  requireRole,
  requirePermission,
  requireEmailVerification,
  rateLimitByUser,
  validateApiKey,
  requireActiveSubscription,
  logRequest
};

