const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../../database.sqlite'),
  logging: process.env.NODE_ENV === 'development' ? console.log : false
});

// User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
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
  company: {
    type: DataTypes.STRING
  },
  role: {
    type: DataTypes.ENUM('user', 'admin', 'reseller'),
    defaultValue: 'user'
  },
  subscription: {
    type: DataTypes.ENUM('starter', 'professional', 'enterprise'),
    defaultValue: 'starter'
  },
  subscriptionStatus: {
    type: DataTypes.ENUM('active', 'inactive', 'cancelled'),
    defaultValue: 'active'
  },
  apiKey: {
    type: DataTypes.STRING,
    unique: true
  },
  minutesUsed: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  minutesLimit: {
    type: DataTypes.INTEGER,
    defaultValue: 100
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

// Call model
const Call = sequelize.define('Call', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  callSid: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: 'id'
    }
  },
  fromNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  toNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('active', 'completed', 'failed'),
    defaultValue: 'active'
  },
  duration: {
    type: DataTypes.INTEGER // in seconds
  },
  transcript: {
    type: DataTypes.TEXT
  },
  conversation: {
    type: DataTypes.JSON
  },
  cost: {
    type: DataTypes.DECIMAL(10, 4)
  },
  startTime: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  endTime: {
    type: DataTypes.DATE
  }
}, {
  timestamps: true
});

// AI Agent model
const AIAgent = sequelize.define('AIAgent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: User,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  greeting: {
    type: DataTypes.TEXT,
    defaultValue: 'Hello! Thank you for calling. How can I help you today?'
  },
  prompt: {
    type: DataTypes.TEXT,
    defaultValue: 'You are a helpful AI assistant. Be professional and concise.'
  },
  voice: {
    type: DataTypes.STRING,
    defaultValue: 'aura-odysseus-en'
  },
  maxCallDuration: {
    type: DataTypes.INTEGER,
    defaultValue: 600
  },
  enableRecording: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  enableTranscription: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  timestamps: true
});

// Define associations
User.hasMany(Call, { foreignKey: 'userId' });
Call.belongsTo(User, { foreignKey: 'userId' });

User.hasMany(AIAgent, { foreignKey: 'userId' });
AIAgent.belongsTo(User, { foreignKey: 'userId' });

// Initialize database
async function initDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');
    
    // Sync models
    await sequelize.sync({ alter: true });
    console.log('Database models synchronized.');
    
    // Create default admin user
    const adminExists = await User.findOne({ where: { email: 'admin@deepgram-ai.com' } });
    if (!adminExists) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = await bcrypt.hash('Admin123!@#', 10);
      
      await User.create({
        email: 'admin@deepgram-ai.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        company: 'Deepgram AI Platform',
        role: 'admin',
        subscription: 'enterprise',
        minutesLimit: -1, // unlimited
        apiKey: 'admin-' + require('crypto').randomBytes(16).toString('hex')
      });
      
      console.log('Default admin user created.');
    }
    
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
}

module.exports = {
  sequelize,
  User,
  Call,
  AIAgent,
  initDatabase
};

