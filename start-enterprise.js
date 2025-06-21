#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');

console.log('🏢 Starting Deepgram AI Enterprise Platform\n');

// Create logs directory if it doesn't exist
if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
  console.log('✅ Created logs directory');
}

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('❌ No .env file found!');
  console.log('\n📋 Creating enterprise .env file...');
  
  const enterpriseEnv = `# Enterprise Deepgram AI Platform Configuration

# API Keys (Required)
DEEPGRAM_API_KEY=your_deepgram_api_key_here
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
OPENAI_API_KEY=your_openai_api_key_here

# Stripe (Required for billing)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Security (Auto-generated)
JWT_SECRET=${crypto.randomBytes(64).toString('hex')}
ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}

# Server Configuration
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com

# Logging
LOG_LEVEL=info

# Database (Enterprise SQLite)
DATABASE_URL=sqlite:./enterprise-database.sqlite

# Voice Configuration
DEFAULT_VOICE=aura-odysseus-en

# Enterprise Features
ENABLE_2FA=true
ENABLE_AUDIT_LOGS=true
ENABLE_ADVANCED_ANALYTICS=true
ENABLE_CUSTOM_BRANDING=true
ENABLE_SSO=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Call Configuration
MAX_CALL_DURATION=1800
MAX_CONCURRENT_CALLS=500
RECORD_CALLS=true
TRANSCRIPT_CALLS=true
ENABLE_SENTIMENT_ANALYSIS=true

# Webhook URLs
WEBHOOK_BASE_URL=https://your-domain.com
`;
  
  fs.writeFileSync('.env', enterpriseEnv);
  console.log('✅ Created .env file with enterprise configuration');
  console.log('\n🔴 IMPORTANT: Update your API keys in the .env file before proceeding!');
  console.log('\n📋 Required API keys:');
  console.log('   • Deepgram API Key: https://console.deepgram.com/');
  console.log('   • Twilio Account: https://console.twilio.com/');
  console.log('   • OpenAI API Key: https://platform.openai.com/api-keys');
  console.log('   • Stripe Keys: https://dashboard.stripe.com/apikeys');
  console.log('\n🚀 Run this script again after updating your API keys.');
  process.exit(1);
}

// Load environment variables
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

// Install enterprise dependencies
console.log('📦 Installing enterprise dependencies...');
try {
  execSync('npm install', { stdio: 'inherit' });
  console.log('✅ Dependencies installed');
} catch (error) {
  console.error('❌ Failed to install dependencies:', error.message);
  process.exit(1);
}

// Test API connections
console.log('🧪 Testing enterprise API connections...');

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

// Test Stripe if configured
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('your_')) {
  try {
    const Stripe = require('stripe');
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('✅ Stripe API connected');
  } catch (error) {
    console.log('⚠️ Stripe API test failed:', error.message);
  }
}

console.log('\n🎉 Enterprise platform ready to start!');
console.log('\n🚀 Starting enterprise server...');

// Start the enterprise application
try {
  require('./enterprise-app.js');
} catch (error) {
  console.error('❌ Failed to start enterprise application:', error);
  process.exit(1);
}

