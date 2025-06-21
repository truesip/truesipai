#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🚀 Setting up Deepgram AI Phone Platform for Production\n');

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('❌ No .env file found!');
  console.log('\n📋 Required setup steps:');
  console.log('\n1. Get your API keys:');
  console.log('   • Deepgram API Key: https://console.deepgram.com/');
  console.log('   • Twilio Account: https://console.twilio.com/');
  console.log('   • OpenAI API Key: https://platform.openai.com/api-keys');
  console.log('\n2. Update the .env file with your real API keys');
  console.log('\n3. Run this script again: node setup-production.js');
  process.exit(1);
}

// Read environment variables
require('dotenv').config();

// Check required API keys
const requiredKeys = [
  'DEEPGRAM_API_KEY',
  'TWILIO_ACCOUNT_SID', 
  'TWILIO_AUTH_TOKEN',
  'OPENAI_API_KEY'
];

let missingKeys = [];
requiredKeys.forEach(key => {
  if (!process.env[key] || process.env[key].includes('your_')) {
    missingKeys.push(key);
  }
});

if (missingKeys.length > 0) {
  console.log('❌ Missing or placeholder API keys:');
  missingKeys.forEach(key => console.log(`   • ${key}`));
  console.log('\n🔧 Please update your .env file with real API keys.');
  process.exit(1);
}

console.log('✅ Environment variables validated');

// Install dependencies
console.log('📦 Installing dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Generate secure keys if they don't exist
let envContent = fs.readFileSync('.env', 'utf8');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.includes('your_')) {
  const jwtSecret = crypto.randomBytes(64).toString('hex');
  envContent = envContent.replace(/JWT_SECRET=.*/, `JWT_SECRET=${jwtSecret}`);
  console.log('✅ Generated secure JWT secret');
}

if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.includes('your_')) {
  const encryptionKey = crypto.randomBytes(32).toString('hex');
  envContent = envContent.replace(/ENCRYPTION_KEY=.*/, `ENCRYPTION_KEY=${encryptionKey}`);
  console.log('✅ Generated secure encryption key');
}

fs.writeFileSync('.env', envContent);

// Initialize database
console.log('🗄️ Initializing database...');
try {
  const { initDatabase } = require('./src/database/models');
  await initDatabase();
  console.log('✅ Database initialized');
} catch (error) {
  console.error('❌ Database initialization failed:', error.message);
}

// Test API connections
console.log('🧪 Testing API connections...');

// Test Deepgram
try {
  const { createClient } = require('@deepgram/sdk');
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  console.log('✅ Deepgram API connected');
} catch (error) {
  console.log('⚠️ Deepgram API test failed:', error.message);
}

// Test OpenAI
try {
  const OpenAI = require('openai');
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('✅ OpenAI API connected');
} catch (error) {
  console.log('⚠️ OpenAI API test failed:', error.message);
}

// Test Twilio
try {
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  console.log('✅ Twilio API connected');
} catch (error) {
  console.log('⚠️ Twilio API test failed:', error.message);
}

console.log('\n🎉 Production setup complete!');
console.log('\n🚀 Next steps:');
console.log('1. Start the server: npm start');
console.log('2. Configure Twilio webhook: https://your-domain.com/webhook/call');
console.log('3. Login to admin panel: http://localhost:3000/login');
console.log('   • Email: admin@deepgram-ai.com');
console.log('   • Password: Admin123!@#');
console.log('\n📞 Test your phone system by calling your Twilio number!');

process.exit(0);

