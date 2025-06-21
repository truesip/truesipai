const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');
const crypto = require('crypto');

// Enhanced enterprise database with PostgreSQL-like features in SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../enterprise-database.sqlite'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    timestamps: true,
    underscored: false,
    paranoid: true // Soft deletes for enterprise audit trails
  }
});

// Organizations (Multi-tenant architecture)
const Organization = sequelize.define('Organization', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  domain: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false
  },
  subdomain: {
    type: DataTypes.STRING,
    unique: true
  },
  plan: {
    type: DataTypes.ENUM('starter', 'professional', 'enterprise', 'enterprise-plus'),
    defaultValue: 'starter'
  },
  status: {
    type: DataTypes.ENUM('trial', 'active', 'suspended', 'cancelled'),
    defaultValue: 'trial'
  },
  settings: {
    type: DataTypes.JSON,
    defaultValue: {
      features: {
        maxAgents: 5,
        maxUsers: 10,
        maxCallMinutes: 1000,
        advancedAnalytics: false,
        customBranding: false,
        apiAccess: false,
        webhooks: false,
        sso: false
      },
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
    }
  },
  billingInfo: {
    type: DataTypes.JSON,
    defaultValue: {
      stripeCustomerId: null,
      subscriptionId: null,
      currentPeriodEnd: null,
      paymentMethod: null
    }
  },
  usage: {
    type: DataTypes.JSON,
    defaultValue: {
      callMinutesUsed: 0,
      agentsCreated: 0,
      usersActive: 0,
      lastUsageReset: new Date()
    }
  },
  trialEndsAt: {
    type: DataTypes.DATE,
    defaultValue: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
});

// Enhanced User model with enterprise features
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    references: {
      model: Organization,
      key: 'id'
    },
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'org_admin', 'manager', 'agent_creator', 'viewer'),
    defaultValue: 'viewer'
  },
  permissions: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  profile: {
    type: DataTypes.JSON,
    defaultValue: {
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
  },
  apiKey: {
    type: DataTypes.STRING,
    unique: true
  },
  apiKeyHash: {
    type: DataTypes.STRING
  },
  twoFactorEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  twoFactorSecret: {
    type: DataTypes.STRING
  },
  lastLoginAt: {
    type: DataTypes.DATE
  },
  lastActiveAt: {
    type: DataTypes.DATE
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  emailVerifiedAt: {
    type: DataTypes.DATE
  }
});

// Enterprise AI Agents with advanced features
const AIAgent = sequelize.define('AIAgent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    references: {
      model: Organization,
      key: 'id'
    },
    allowNull: false
  },
  createdBy: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: 'id'
    },
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  category: {
    type: DataTypes.ENUM('customer_service', 'sales', 'support', 'reception', 'booking', 'information', 'custom'),
    defaultValue: 'customer_service'
  },
  version: {
    type: DataTypes.STRING,
    defaultValue: '1.0.0'
  },
  configuration: {
    type: DataTypes.JSON,
    defaultValue: {
      voice: {
        model: 'aura-odysseus-en',
        speed: 1.0,
        pitch: 1.0,
        volume: 1.0
      },
      personality: {
        traits: ['professional', 'helpful'],
        temperature: 0.7,
        maxTokens: 150,
        responseStyle: 'concise'
      },
      conversation: {
        greeting: 'Hello! How can I help you today?',
        maxDuration: 600,
        silenceTimeout: 10,
        endPhrases: ['goodbye', 'bye', 'thank you']
      },
      intelligence: {
        model: 'gpt-4-turbo-preview',
        systemPrompt: '',
        knowledgeBase: '',
        escalationRules: ''
      },
      integrations: {
        crm: null,
        calendar: null,
        helpdesk: null,
        webhook: null
      }
    }
  },
  trainingData: {
    type: DataTypes.JSON,
    defaultValue: {
      documents: [],
      faqs: [],
      conversations: [],
      feedback: []
    }
  },
  analytics: {
    type: DataTypes.JSON,
    defaultValue: {
      totalCalls: 0,
      averageRating: 0,
      resolutionRate: 0,
      averageDuration: 0,
      lastCallAt: null
    }
  },
  deployment: {
    type: DataTypes.JSON,
    defaultValue: {
      status: 'draft',
      environment: 'development',
      phoneNumbers: [],
      webhookUrl: null,
      lastDeployedAt: null
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isPublic: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Enterprise Call Records with advanced tracking
const Call = sequelize.define('Call', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    references: {
      model: Organization,
      key: 'id'
    },
    allowNull: false
  },
  agentId: {
    type: DataTypes.UUID,
    references: {
      model: AIAgent,
      key: 'id'
    }
  },
  callSid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  fromNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  toNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  direction: {
    type: DataTypes.ENUM('inbound', 'outbound'),
    defaultValue: 'inbound'
  },
  status: {
    type: DataTypes.ENUM('ringing', 'in-progress', 'completed', 'failed', 'busy', 'no-answer'),
    defaultValue: 'ringing'
  },
  duration: {
    type: DataTypes.INTEGER // in seconds
  },
  startTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  answerTime: {
    type: DataTypes.DATE
  },
  endTime: {
    type: DataTypes.DATE
  },
  recording: {
    type: DataTypes.JSON,
    defaultValue: {
      url: null,
      duration: 0,
      size: 0,
      format: 'wav'
    }
  },
  transcript: {
    type: DataTypes.TEXT
  },
  conversation: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  sentiment: {
    type: DataTypes.JSON,
    defaultValue: {
      overall: 'neutral',
      score: 0,
      confidence: 0,
      emotions: []
    }
  },
  outcome: {
    type: DataTypes.JSON,
    defaultValue: {
      resolution: null,
      satisfaction: null,
      followUpRequired: false,
      tags: []
    }
  },
  cost: {
    type: DataTypes.DECIMAL(10, 4),
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {
      userAgent: null,
      ipAddress: null,
      referrer: null,
      campaign: null
    }
  }
});

// Analytics and Reporting
const Analytics = sequelize.define('Analytics', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    references: {
      model: Organization,
      key: 'id'
    },
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'custom'),
    allowNull: false
  },
  period: {
    type: DataTypes.STRING, // e.g., '2024-01-15' or '2024-W03'
    allowNull: false
  },
  metrics: {
    type: DataTypes.JSON,
    defaultValue: {
      calls: {
        total: 0,
        inbound: 0,
        outbound: 0,
        completed: 0,
        failed: 0
      },
      duration: {
        total: 0,
        average: 0,
        median: 0
      },
      agents: {
        active: 0,
        calls: {},
        performance: {}
      },
      satisfaction: {
        average: 0,
        distribution: {}
      },
      costs: {
        total: 0,
        perMinute: 0,
        perCall: 0
      }
    }
  }
});

// Integrations
const Integration = sequelize.define('Integration', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    references: {
      model: Organization,
      key: 'id'
    },
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('crm', 'helpdesk', 'calendar', 'analytics', 'webhook', 'sso'),
    allowNull: false
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false // e.g., 'salesforce', 'hubspot', 'zendesk'
  },
  configuration: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  credentials: {
    type: DataTypes.TEXT, // Encrypted
    set(value) {
      if (value) {
        const cipher = crypto.createCipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
        let encrypted = cipher.update(JSON.stringify(value), 'utf8', 'hex');
        encrypted += cipher.final('hex');
        this.setDataValue('credentials', encrypted);
      }
    },
    get() {
      const encrypted = this.getDataValue('credentials');
      if (encrypted) {
        try {
          const decipher = crypto.createDecipher('aes-256-cbc', process.env.ENCRYPTION_KEY);
          let decrypted = decipher.update(encrypted, 'hex', 'utf8');
          decrypted += decipher.final('utf8');
          return JSON.parse(decrypted);
        } catch (error) {
          return null;
        }
      }
      return null;
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'error'),
    defaultValue: 'inactive'
  },
  lastSyncAt: {
    type: DataTypes.DATE
  }
});

// Audit Logs for enterprise compliance
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    references: {
      model: Organization,
      key: 'id'
    },
    allowNull: false
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: 'id'
    }
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resource: {
    type: DataTypes.STRING,
    allowNull: false
  },
  resourceId: {
    type: DataTypes.STRING
  },
  changes: {
    type: DataTypes.JSON
  },
  metadata: {
    type: DataTypes.JSON,
    defaultValue: {
      ipAddress: null,
      userAgent: null,
      timestamp: new Date()
    }
  }
}, {
  updatedAt: false
});

// Billing and Usage Tracking
const BillingRecord = sequelize.define('BillingRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  organizationId: {
    type: DataTypes.UUID,
    references: {
      model: Organization,
      key: 'id'
    },
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('subscription', 'usage', 'overage', 'credit', 'refund'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'USD'
  },
  period: {
    type: DataTypes.JSON,
    defaultValue: {
      start: null,
      end: null
    }
  },
  usage: {
    type: DataTypes.JSON,
    defaultValue: {
      callMinutes: 0,
      agents: 0,
      users: 0
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'pending'
  },
  stripeInvoiceId: {
    type: DataTypes.STRING
  },
  paidAt: {
    type: DataTypes.DATE
  }
});

// Define all associations
Organization.hasMany(User, { foreignKey: 'organizationId', as: 'users' });
User.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Organization.hasMany(AIAgent, { foreignKey: 'organizationId', as: 'agents' });
AIAgent.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
AIAgent.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

Organization.hasMany(Call, { foreignKey: 'organizationId', as: 'calls' });
Call.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
Call.belongsTo(AIAgent, { foreignKey: 'agentId', as: 'agent' });

Organization.hasMany(Analytics, { foreignKey: 'organizationId', as: 'analytics' });
Analytics.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Organization.hasMany(Integration, { foreignKey: 'organizationId', as: 'integrations' });
Integration.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

Organization.hasMany(AuditLog, { foreignKey: 'organizationId', as: 'auditLogs' });
AuditLog.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });
AuditLog.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Organization.hasMany(BillingRecord, { foreignKey: 'organizationId', as: 'billingRecords' });
BillingRecord.belongsTo(Organization, { foreignKey: 'organizationId', as: 'organization' });

// Initialize enterprise database
async function initEnterpriseDatabase() {
  try {
    await sequelize.authenticate();
    console.log('🏢 Enterprise database connection established successfully.');
    
    // Sync all models
    await sequelize.sync({ alter: true });
    console.log('📊 Enterprise database models synchronized.');
    
    // Create default organization and super admin
    const defaultOrg = await Organization.findOne({ where: { domain: 'deepgram-ai.com' } });
    if (!defaultOrg) {
      const organization = await Organization.create({
        name: 'Deepgram AI Platform',
        domain: 'deepgram-ai.com',
        subdomain: 'admin',
        plan: 'enterprise-plus',
        status: 'active',
        settings: {
          features: {
            maxAgents: -1, // unlimited
            maxUsers: -1,
            maxCallMinutes: -1,
            advancedAnalytics: true,
            customBranding: true,
            apiAccess: true,
            webhooks: true,
            sso: true
          }
        }
      });
      
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('EnterpriseAdmin2024!', 12);
      
      await User.create({
        organizationId: organization.id,
        email: 'admin@deepgram-ai.com',
        password: hashedPassword,
        firstName: 'Super',
        lastName: 'Administrator',
        role: 'super_admin',
        permissions: ['*'], // All permissions
        apiKey: 'ent-' + crypto.randomBytes(32).toString('hex'),
        emailVerifiedAt: new Date()
      });
      
      console.log('🏢 Default enterprise organization and super admin created.');
    }
    
  } catch (error) {
    console.error('❌ Unable to connect to the enterprise database:', error);
    throw error;
  }
}

module.exports = {
  sequelize,
  Organization,
  User,
  AIAgent,
  Call,
  Analytics,
  Integration,
  AuditLog,
  BillingRecord,
  initEnterpriseDatabase
};

