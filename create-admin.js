#!/usr/bin/env node

const readline = require('readline');
const { initDatabase, User } = require('./src/database/models');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function createAdminAccount() {
  console.log('🚀 Create Real Admin Account for Deepgram AI Phone Platform\n');
  
  try {
    // Initialize database
    await initDatabase();
    
    // Get admin details
    const email = await question('Enter admin email: ');
    const password = await question('Enter admin password: ');
    const firstName = await question('Enter first name: ');
    const lastName = await question('Enter last name: ');
    const company = await question('Enter company name (optional): ') || 'Deepgram AI Platform';
    
    // Validate inputs
    if (!email || !password || !firstName || !lastName) {
      console.log('❌ All fields except company are required!');
      process.exit(1);
    }
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingAdmin) {
      console.log('❌ Admin user with this email already exists!');
      process.exit(1);
    }
    
    // Validate password strength
    if (password.length < 8) {
      console.log('❌ Password must be at least 8 characters long!');
      process.exit(1);
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const apiKey = 'admin-' + crypto.randomBytes(16).toString('hex');
    
    // Create admin user
    const admin = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      firstName,
      lastName,
      company,
      role: 'admin',
      subscription: 'enterprise',
      subscriptionStatus: 'active',
      apiKey,
      minutesLimit: -1, // unlimited
      minutesUsed: 0,
      isActive: true
    });
    
    console.log('\n✅ Admin account created successfully!');
    console.log('\n📋 Admin Details:');
    console.log(`Email: ${admin.email}`);
    console.log(`Name: ${admin.firstName} ${admin.lastName}`);
    console.log(`Company: ${admin.company}`);
    console.log(`Role: ${admin.role}`);
    console.log(`Subscription: ${admin.subscription}`);
    console.log(`API Key: ${admin.apiKey}`);
    
    console.log('\n🚀 Next steps:');
    console.log('1. Start your server: npm start');
    console.log('2. Login at: http://localhost:3000/login');
    console.log(`3. Use email: ${admin.email}`);
    console.log('4. Use the password you just entered');
    
  } catch (error) {
    console.error('❌ Error creating admin account:', error.message);
    process.exit(1);
  } finally {
    rl.close();
    process.exit(0);
  }
}

createAdminAccount();

