const express = require('express');
const rateLimit = require('express-rate-limit');
const joi = require('joi');
const { authenticateToken, requireRole, logRequest } = require('../middleware/auth');

function createAuthRoutes(authManager) {
  const router = express.Router();

  // Rate limiting for auth endpoints
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    trustProxy: true // Trust proxy headers for correct IP detection
  });

  const signupLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Limit each IP to 3 signups per hour
    message: { error: 'Too many signup attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    trustProxy: true
  });

  // Validation schemas
  const signupSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(8).required(),
    firstName: joi.string().min(2).max(50).required(),
    lastName: joi.string().min(2).max(50).required(),
    companyName: joi.string().max(100).optional(),
    phone: joi.string().optional(),
    role: joi.string().valid('user', 'reseller').default('user')
  });

  const loginSchema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().required()
  });

  const passwordResetSchema = joi.object({
    email: joi.string().email().required()
  });

  const passwordResetConfirmSchema = joi.object({
    token: joi.string().required(),
    password: joi.string().min(8).required()
  });

  // Apply logging to all auth routes
  router.use(logRequest());

  // POST /auth/signup - User registration
  router.post('/signup', signupLimiter, async (req, res) => {
    try {
      const { error, value } = signupSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const user = await authManager.createUser(value);
      
      res.status(201).json({
        success: true,
        message: 'User created successfully. Please check your email for verification.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          emailVerified: user.emailVerified
        }
      });
    } catch (error) {
      console.error('Signup error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // POST /auth/login - User login
  router.post('/login', authLimiter, async (req, res) => {
    try {
      const { error, value } = loginSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const { email, password } = value;
      const result = await authManager.authenticateUser(email, password);
      
      res.json({
        success: true,
        message: 'Login successful',
        user: result.user,
        token: result.token,
        expiresAt: result.expiresAt
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        error: error.message
      });
    }
  });

  // POST /auth/logout - User logout
  router.post('/logout', authenticateToken(authManager), (req, res) => {
    try {
      const token = req.headers.authorization?.split(' ')[1];
      authManager.logout(token);
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed'
      });
    }
  });

  // GET /auth/me - Get current user
  router.get('/me', authenticateToken(authManager), (req, res) => {
    res.json({
      success: true,
      user: req.user
    });
  });

  // PUT /auth/me - Update current user profile
  router.put('/me', authenticateToken(authManager), async (req, res) => {
    try {
      const updateSchema = joi.object({
        firstName: joi.string().min(2).max(50).optional(),
        lastName: joi.string().min(2).max(50).optional(),
        companyName: joi.string().max(100).optional(),
        phone: joi.string().optional(),
        settings: joi.object({
          emailNotifications: joi.boolean().optional(),
          smsNotifications: joi.boolean().optional(),
          timezone: joi.string().optional()
        }).optional()
      });

      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const updatedUser = authManager.updateUser(req.user.id, value);
      
      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Profile update error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // POST /auth/verify-email - Verify email address
  router.post('/verify-email', async (req, res) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({
          error: 'Verification token required'
        });
      }

      await authManager.verifyEmail(token);
      
      res.json({
        success: true,
        message: 'Email verified successfully'
      });
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // POST /auth/resend-verification - Resend email verification
  router.post('/resend-verification', authenticateToken(authManager), (req, res) => {
    try {
      if (req.user.emailVerified) {
        return res.status(400).json({
          error: 'Email is already verified'
        });
      }

      const verificationToken = authManager.generateEmailVerificationToken(req.user.id);
      
      // In a real app, you would send an email here
      console.log(`Verification token for ${req.user.email}: ${verificationToken}`);
      
      res.json({
        success: true,
        message: 'Verification email sent'
      });
    } catch (error) {
      console.error('Resend verification error:', error);
      res.status(500).json({
        error: 'Failed to send verification email'
      });
    }
  });

  // POST /auth/forgot-password - Request password reset
  router.post('/forgot-password', authLimiter, async (req, res) => {
    try {
      const { error, value } = passwordResetSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const { email } = value;
      const resetToken = authManager.generatePasswordResetToken(email);
      
      // In a real app, you would send an email here
      console.log(`Password reset token for ${email}: ${resetToken}`);
      
      res.json({
        success: true,
        message: 'Password reset email sent if account exists'
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      // Don't reveal if email exists or not
      res.json({
        success: true,
        message: 'Password reset email sent if account exists'
      });
    }
  });

  // POST /auth/reset-password - Reset password with token
  router.post('/reset-password', authLimiter, async (req, res) => {
    try {
      const { error, value } = passwordResetConfirmSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }

      const { token, password } = value;
      await authManager.resetPassword(token, password);
      
      res.json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error) {
      console.error('Password reset error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // GET /auth/stats - Get user statistics (admin only)
  router.get('/stats', 
    authenticateToken(authManager),
    requireRole(['super_admin', 'admin']),
    (req, res) => {
      try {
        const stats = authManager.getUserStats();
        
        res.json({
          success: true,
          stats
        });
      } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
          error: 'Failed to retrieve statistics'
        });
      }
    }
  );

  return router;
}

module.exports = { createAuthRoutes };

