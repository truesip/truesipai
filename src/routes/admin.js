const express = require('express');
const joi = require('joi');
const { authenticateToken, requireRole, requirePermission, logRequest } = require('../middleware/auth');

function createAdminRoutes(authManager, agentManager, resellerManager) {
  const router = express.Router();

  // Apply authentication and admin role requirement to all routes
  router.use(authenticateToken(authManager));
  router.use(requireRole(['super_admin', 'admin']));
  router.use(logRequest());

  // GET /admin/dashboard - Admin dashboard overview
  router.get('/dashboard', (req, res) => {
    try {
      const userStats = authManager.getUserStats();
      const agentStats = {
        total: agentManager.listAgents().length,
        active: agentManager.listAgents({ status: 'active' }).length,
        inactive: agentManager.listAgents({ status: 'inactive' }).length
      };
      
      const resellerStats = {
        total: resellerManager.resellers.size,
        active: Array.from(resellerManager.resellers.values()).filter(r => r.status === 'active').length,
        totalRevenue: Array.from(resellerManager.resellers.values()).reduce((sum, r) => sum + r.metrics.totalRevenue, 0)
      };

      res.json({
        success: true,
        dashboard: {
          users: userStats,
          agents: agentStats,
          resellers: resellerStats,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Dashboard error:', error);
      res.status(500).json({
        error: 'Failed to load dashboard data'
      });
    }
  });

  // GET /admin/users - List all users
  router.get('/users', (req, res) => {
    try {
      const { role, status, page = 1, limit = 50 } = req.query;
      
      const filters = {};
      if (role) filters.role = role;
      if (status) filters.status = status;
      
      const users = authManager.getAllUsers(filters);
      
      // Pagination
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + parseInt(limit);
      const paginatedUsers = users.slice(startIndex, endIndex);
      
      res.json({
        success: true,
        users: paginatedUsers,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(users.length / limit),
          count: users.length
        }
      });
    } catch (error) {
      console.error('List users error:', error);
      res.status(500).json({
        error: 'Failed to retrieve users'
      });
    }
  });

  // GET /admin/users/:userId - Get specific user
  router.get('/users/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      const user = authManager.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({
          error: 'User not found'
        });
      }
      
      res.json({
        success: true,
        user: { ...user, password: undefined }
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        error: 'Failed to retrieve user'
      });
    }
  });

  // PUT /admin/users/:userId - Update user
  router.put('/users/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      
      const updateSchema = joi.object({
        firstName: joi.string().min(2).max(50).optional(),
        lastName: joi.string().min(2).max(50).optional(),
        email: joi.string().email().optional(),
        role: joi.string().valid('user', 'admin', 'reseller', 'super_admin').optional(),
        status: joi.string().valid('active', 'inactive', 'suspended', 'pending').optional(),
        companyName: joi.string().max(100).optional(),
        phone: joi.string().optional(),
        emailVerified: joi.boolean().optional()
      });
      
      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }
      
      const updatedUser = authManager.updateUser(userId, value);
      
      res.json({
        success: true,
        message: 'User updated successfully',
        user: updatedUser
      });
    } catch (error) {
      console.error('Update user error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // DELETE /admin/users/:userId - Delete user
  router.delete('/users/:userId', requireRole(['super_admin']), (req, res) => {
    try {
      const { userId } = req.params;
      
      if (userId === req.user.id) {
        return res.status(400).json({
          error: 'Cannot delete your own account'
        });
      }
      
      authManager.deleteUser(userId);
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // POST /admin/users/:userId/suspend - Suspend user
  router.post('/users/:userId/suspend', (req, res) => {
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      
      if (userId === req.user.id) {
        return res.status(400).json({
          error: 'Cannot suspend your own account'
        });
      }
      
      const suspendedUser = authManager.suspendUser(userId, reason || 'Suspended by admin');
      
      res.json({
        success: true,
        message: 'User suspended successfully',
        user: suspendedUser
      });
    } catch (error) {
      console.error('Suspend user error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // POST /admin/users/:userId/reactivate - Reactivate suspended user
  router.post('/users/:userId/reactivate', (req, res) => {
    try {
      const { userId } = req.params;
      
      const reactivatedUser = authManager.reactivateUser(userId);
      
      res.json({
        success: true,
        message: 'User reactivated successfully',
        user: reactivatedUser
      });
    } catch (error) {
      console.error('Reactivate user error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // GET /admin/agents - List all agents
  router.get('/agents', (req, res) => {
    try {
      const { status, templateId } = req.query;
      
      const filters = {};
      if (status) filters.status = status;
      if (templateId) filters.templateId = templateId;
      
      const agents = agentManager.listAgents(filters);
      
      res.json({
        success: true,
        agents
      });
    } catch (error) {
      console.error('List agents error:', error);
      res.status(500).json({
        error: 'Failed to retrieve agents'
      });
    }
  });

  // GET /admin/agents/templates - List agent templates
  router.get('/agents/templates', (req, res) => {
    try {
      const templates = agentManager.getTemplates();
      
      res.json({
        success: true,
        templates
      });
    } catch (error) {
      console.error('List templates error:', error);
      res.status(500).json({
        error: 'Failed to retrieve templates'
      });
    }
  });

  // POST /admin/agents - Create new agent
  router.post('/agents', (req, res) => {
    try {
      const createSchema = joi.object({
        templateId: joi.string().required(),
        name: joi.string().min(2).max(100).optional(),
        greeting: joi.string().max(500).optional(),
        prompt: joi.string().max(2000).optional(),
        voice: joi.string().optional(),
        maxCallDuration: joi.number().integer().min(60).max(3600).optional()
      });
      
      const { error, value } = createSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }
      
      const { templateId, ...customConfig } = value;
      const agent = agentManager.createAgent(templateId, customConfig);
      
      res.status(201).json({
        success: true,
        message: 'Agent created successfully',
        agent
      });
    } catch (error) {
      console.error('Create agent error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // PUT /admin/agents/:agentId - Update agent
  router.put('/agents/:agentId', (req, res) => {
    try {
      const { agentId } = req.params;
      
      const updateSchema = joi.object({
        name: joi.string().min(2).max(100).optional(),
        greeting: joi.string().max(500).optional(),
        prompt: joi.string().max(2000).optional(),
        voice: joi.string().optional(),
        maxCallDuration: joi.number().integer().min(60).max(3600).optional(),
        status: joi.string().valid('active', 'inactive').optional()
      });
      
      const { error, value } = updateSchema.validate(req.body);
      if (error) {
        return res.status(400).json({
          error: 'Validation error',
          details: error.details.map(d => d.message)
        });
      }
      
      const updatedAgent = agentManager.updateAgent(agentId, value);
      
      res.json({
        success: true,
        message: 'Agent updated successfully',
        agent: updatedAgent
      });
    } catch (error) {
      console.error('Update agent error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // DELETE /admin/agents/:agentId - Delete agent
  router.delete('/agents/:agentId', (req, res) => {
    try {
      const { agentId } = req.params;
      
      agentManager.deleteAgent(agentId);
      
      res.json({
        success: true,
        message: 'Agent deleted successfully'
      });
    } catch (error) {
      console.error('Delete agent error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // GET /admin/resellers - List all resellers
  router.get('/resellers', (req, res) => {
    try {
      const resellers = Array.from(resellerManager.resellers.entries()).map(([id, reseller]) => ({
        id,
        company: reseller.company,
        contact: reseller.contact,
        subscription: reseller.subscription,
        metrics: reseller.metrics,
        status: reseller.status,
        createdAt: reseller.createdAt
      }));
      
      res.json({
        success: true,
        resellers
      });
    } catch (error) {
      console.error('List resellers error:', error);
      res.status(500).json({
        error: 'Failed to retrieve resellers'
      });
    }
  });

  // GET /admin/resellers/:resellerId - Get specific reseller
  router.get('/resellers/:resellerId', (req, res) => {
    try {
      const { resellerId } = req.params;
      const dashboard = resellerManager.getResellerDashboard(resellerId);
      
      res.json({
        success: true,
        reseller: dashboard
      });
    } catch (error) {
      console.error('Get reseller error:', error);
      res.status(400).json({
        error: error.message
      });
    }
  });

  // GET /admin/system/logs - Get system logs (super admin only)
  router.get('/system/logs', requireRole(['super_admin']), (req, res) => {
    try {
      // In a real implementation, you would fetch logs from your logging system
      const logs = [
        {
          id: '1',
          timestamp: new Date(),
          level: 'info',
          message: 'User login successful',
          userId: 'user123',
          ip: '192.168.1.1'
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 3600000),
          level: 'warning',
          message: 'Rate limit exceeded',
          ip: '192.168.1.2'
        }
      ];
      
      res.json({
        success: true,
        logs
      });
    } catch (error) {
      console.error('Get logs error:', error);
      res.status(500).json({
        error: 'Failed to retrieve logs'
      });
    }
  });

  // GET /admin/system/config - Get system configuration (super admin only)
  router.get('/system/config', requireRole(['super_admin']), (req, res) => {
    try {
      const config = {
        environment: process.env.NODE_ENV || 'development',
        features: {
          emailVerification: true,
          twoFactorAuth: false,
          apiRateLimit: true
        },
        limits: {
          maxUsersPerReseller: 100,
          maxConcurrentCalls: 50,
          defaultCallDuration: 600
        }
      };
      
      res.json({
        success: true,
        config
      });
    } catch (error) {
      console.error('Get config error:', error);
      res.status(500).json({
        error: 'Failed to retrieve configuration'
      });
    }
  });

  // POST /admin/system/cleanup - Clean up expired sessions and tokens
  router.post('/system/cleanup', requireRole(['super_admin']), (req, res) => {
    try {
      authManager.cleanupExpiredSessions();
      
      res.json({
        success: true,
        message: 'System cleanup completed'
      });
    } catch (error) {
      console.error('System cleanup error:', error);
      res.status(500).json({
        error: 'System cleanup failed'
      });
    }
  });

  return router;
}

module.exports = { createAdminRoutes };

