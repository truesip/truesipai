const AuthManager = require('./src/auth/AuthManager');
const { initDatabase, User } = require('./src/database/models');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Check environment variables
function checkEnvironmentVariables() {
  console.log('🔧 Checking environment variables...');
  
  const requiredVars = {
    'JWT_SECRET': process.env.JWT_SECRET,
    'DEFAULT_ADMIN_EMAIL': process.env.DEFAULT_ADMIN_EMAIL,
    'DEFAULT_ADMIN_PASSWORD': process.env.DEFAULT_ADMIN_PASSWORD,
    'NODE_ENV': process.env.NODE_ENV
  };
  
  let allGood = true;
  
  for (const [varName, value] of Object.entries(requiredVars)) {
    if (!value || value.includes('your_') || value.includes('change_')) {
      console.log(`⚠️  ${varName}: ${value || 'NOT SET'} (needs to be configured)`);
      if (varName === 'JWT_SECRET' || varName === 'DEFAULT_ADMIN_EMAIL') {
        allGood = false;
      }
    } else {
      console.log(`✅ ${varName}: ${varName.includes('PASSWORD') ? '***hidden***' : value}`);
    }
  }
  
  return allGood;
}

async function debugAuthentication() {
  console.log('🔍 Starting authentication debug...');
  
  // Check environment variables first
  if (!checkEnvironmentVariables()) {
    console.log('\n⚠️  Some environment variables need to be configured.');
    console.log('Please check your .env file and restart the application.');
    return;
  }
  
  try {
    // Initialize database
    console.log('\n📄 Initializing database...');
    await initDatabase();
    
    // Create auth manager
    const authManager = new AuthManager();
    
    // Test data
    const testUser = {
      email: 'test@example.com',
      password: 'TestUser123!',
      firstName: 'Test',
      lastName: 'User',
      companyName: 'Test Company'
    };
    
    console.log('\n👤 Creating test user...');
    console.log('Email:', testUser.email);
    console.log('Password:', testUser.password);
    
    // Check if user already exists
    const existingUser = await User.findOne({ where: { email: testUser.email.toLowerCase() } });
    if (existingUser) {
      console.log('⚠️  User already exists, deleting...');
      await existingUser.destroy();
    }
    
    // Create user
    try {
      const newUser = await authManager.createUser(testUser);
      console.log('✅ User created successfully:', {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      });
    } catch (createError) {
      console.error('❌ Error creating user:', createError.message);
      return;
    }
    
    // Verify user was saved to database
    console.log('\n🔍 Checking user in database...');
    const savedUser = await User.findOne({ where: { email: testUser.email.toLowerCase() } });
    if (savedUser) {
      console.log('✅ User found in database:', {
        id: savedUser.id,
        email: savedUser.email,
        isActive: savedUser.isActive,
        hasPassword: !!savedUser.password
      });
      
      // Test password comparison directly
      console.log('\n🔐 Testing password hash...');
      const isPasswordValid = await bcrypt.compare(testUser.password, savedUser.password);
      console.log('Password comparison result:', isPasswordValid);
      
    } else {
      console.error('❌ User not found in database after creation!');
      return;
    }
    
    // Test authentication
    console.log('\n🔐 Testing authentication...');
    try {
      const authResult = await authManager.authenticateUser(testUser.email, testUser.password);
      console.log('✅ Authentication successful:', {
        userId: authResult.user.id,
        email: authResult.user.email,
        hasToken: !!authResult.token
      });
    } catch (authError) {
      console.error('❌ Authentication failed:', authError.message);
      
      // Additional debugging
      console.log('\n🔍 Additional debugging...');
      const dbUser = await User.findOne({ where: { email: testUser.email.toLowerCase() } });
      if (dbUser) {
        console.log('User exists with email:', dbUser.email);
        console.log('User is active:', dbUser.isActive);
        console.log('Password hash exists:', !!dbUser.password);
        
        // Test password again
        const passwordTest = await bcrypt.compare(testUser.password, dbUser.password);
        console.log('Direct bcrypt compare:', passwordTest);
      }
    }
    
    // List all users in database
    console.log('\n📋 All users in database:');
    const allUsers = await User.findAll({ attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'role'] });
    allUsers.forEach(user => {
      console.log(`- ${user.email} (${user.firstName} ${user.lastName}) - Active: ${user.isActive} - Role: ${user.role}`);
    });
    
  } catch (error) {
    console.error('💥 Fatal error:', error);
  }
}

// Run the debug
debugAuthentication().then(() => {
  console.log('\n🏁 Debug complete');
  process.exit(0);
}).catch(error => {
  console.error('💥 Debug failed:', error);
  process.exit(1);
});

