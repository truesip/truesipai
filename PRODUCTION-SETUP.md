# 🚀 Production Setup Guide

## Transform Your Demo into a Real Business Platform

This guide will help you convert the demo platform into a fully functional, production-ready AI phone system for your business.

## ⚡ Quick Setup (5 minutes)

### 1. Get Your API Keys

You need these 4 API keys to make the platform functional:

#### A. Deepgram API Key
- Go to [Deepgram Console](https://console.deepgram.com/)
- Sign up/login and get your API key
- Copy the key (starts with `sk_`)

#### B. Twilio Account
- Go to [Twilio Console](https://console.twilio.com/)
- Sign up and get:
  - Account SID
  - Auth Token  
  - Phone Number (buy one for $1/month)

#### C. OpenAI API Key
- Go to [OpenAI Platform](https://platform.openai.com/api-keys)
- Create an API key
- Add $10+ credits to your account

### 2. Configure Environment

Edit your `.env` file and replace the placeholder values:

```bash
# Replace these with your real API keys:
DEEPGRAM_API_KEY=sk_your_actual_deepgram_key_here
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3. Run Production Setup

```bash
node setup-production.js
```

This will:
- ✅ Validate your API keys
- ✅ Install all dependencies
- ✅ Generate secure encryption keys
- ✅ Initialize the database
- ✅ Test API connections
- ✅ Create admin user

### 4. Start the Server

```bash
npm start
```

### 5. Configure Twilio Webhook

1. Go to [Twilio Console → Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/active)
2. Click on your phone number
3. Set the webhook URL to: `https://your-domain.com/webhook/call`
4. Set HTTP method to `POST`
5. Save configuration

## 🔐 Admin Access

Login to your admin panel:
- URL: `http://localhost:3000/login`
- Email: `admin@deepgram-ai.com`
- Password: `Admin123!@#`

## 📊 What You Get

### Real Features (Not Demo):

✅ **Real AI Conversations** - Using OpenAI GPT-4 for intelligent responses
✅ **Live Voice Processing** - Deepgram Aura 2 (Odysseus voice) 
✅ **Database Storage** - SQLite database for user/call management
✅ **User Management** - Real authentication and subscription system
✅ **Call Analytics** - Full conversation logging and metrics
✅ **Admin Dashboard** - Complete control panel
✅ **API Management** - Rate limiting and security
✅ **Reseller Support** - Multi-tenant architecture

## 💰 Business Features

### Subscription Tiers:
- **Starter**: 100 minutes/month - $29/month
- **Professional**: 500 minutes/month - $99/month  
- **Enterprise**: Unlimited - $299/month

### Admin Features:
- User management
- Call monitoring
- AI agent configuration
- Usage analytics
- Billing management

## 🌐 Deploy to Production

### Option 1: DigitalOcean (Recommended)

1. Fork this repository
2. Connect to DigitalOcean App Platform
3. Set environment variables in DO console
4. Deploy with one click

### Option 2: Manual Server

```bash
# On your server:
git clone your-repo
cd deepgram-ai-phone-platform
npm install
node setup-production.js
npm start
```

### Option 3: Docker

```bash
docker build -t ai-phone-platform .
docker run -p 3000:3000 --env-file .env ai-phone-platform
```

## 🔧 Customization

### Configure AI Behavior

Edit the AI prompt in `app.js`:

```javascript
const DEFAULT_AGENT_CONFIG = {
  greeting: 'Welcome to [Your Company]! How can I help you today?',
  prompt: `You are a professional customer service agent for [Your Company]. 
  - Always be helpful and polite
  - Know our products: [list your products/services]
  - Escalate complex issues to human agents
  - Keep responses under 30 seconds`,
  voice: 'aura-odysseus-en'
};
```

### Customize Branding

1. Update `package.json` with your company info
2. Modify HTML files in `/public` folder
3. Add your logo and colors
4. Update email templates

## 🛡️ Security Features

- ✅ Rate limiting (100 requests/15 minutes)
- ✅ CORS protection
- ✅ Helmet security headers
- ✅ JWT authentication
- ✅ Encrypted data storage
- ✅ Input validation
- ✅ Audit logging

## 📈 Monitoring

### Built-in Analytics:
- Call volume and duration
- AI response accuracy
- User subscription status
- Revenue tracking
- Error monitoring

### Health Checks:
- `/health` - Server status
- `/api` - API information
- Real-time call monitoring

## 💡 Business Use Cases

### 1. Customer Support
- 24/7 automated support
- Handle common inquiries
- Escalate complex issues
- Reduce support costs

### 2. Sales & Lead Qualification
- Screen incoming leads
- Collect customer information
- Schedule appointments
- Follow up on inquiries

### 3. Appointment Booking
- Accept reservations
- Check availability
- Send confirmations
- Handle cancellations

### 4. Information Services
- Business hours and location
- Product information
- Pricing inquiries
- FAQ responses

## 🚨 Troubleshooting

### Common Issues:

**"Features not working"** 
- Check if API keys are real (not placeholders)
- Run `node setup-production.js` to verify

**"No audio in calls"**
- Verify Twilio webhook is configured correctly
- Check Deepgram API credits

**"AI not responding"**
- Verify OpenAI API key has credits
- Check console for error messages

**"Database errors"**
- Delete `database.sqlite` and restart
- Check file permissions

## 📞 Support

For production support:
- 📧 Email: support@yourcompany.com
- 💬 Discord: [Join community](https://discord.gg/yourserver)
- 📖 Docs: Full documentation available
- 🐛 Issues: GitHub Issues for bugs

## 🎯 Next Steps

Once your platform is running:

1. **Test the system** - Call your Twilio number
2. **Customize AI responses** - Edit prompts for your business
3. **Set up billing** - Integrate Stripe for payments
4. **Add team members** - Create user accounts
5. **Monitor performance** - Watch call analytics
6. **Scale up** - Increase server resources as needed

---

**🎉 Congratulations! You now have a fully functional AI phone platform for your business!**

