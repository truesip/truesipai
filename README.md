# 🚀 Deepgram AI Phone Platform (SaaS)

## Enterprise-Grade AI Phone Call Solution with Aura 2 (Odysseus Voice)

**Complete SaaS Platform for Startups & Resellers** - A multi-tenant AI-powered phone system using Deepgram's latest Aura 2 technology with premium Odysseus voice, featuring user management, admin dashboard, and reseller capabilities.

### ✨ Features

- 🎯 **Aura 2 (Odysseus Voice)** - Premium AI voice with natural conversation flow
- 📞 **VOIP Integration** - Full inbound call support via Twilio
- 🤖 **Custom AI Agents** - Configurable prompts and personalities
- 🔊 **Real-time Processing** - Live speech-to-text and text-to-speech
- 🏢 **Enterprise Security** - Rate limiting, CORS, encryption
- 📊 **Call Analytics** - Full conversation logging and metrics
- 🚀 **DigitalOcean Ready** - One-click deployment
- 💼 **Reseller Friendly** - White-label ready platform

### 🛠️ Technology Stack

- **Backend**: Node.js + Express
- **AI Voice**: Deepgram Aura 2 (Odysseus)
- **VOIP**: Twilio Voice API
- **Real-time**: WebSockets + Socket.IO
- **Deployment**: DigitalOcean App Platform
- **Security**: Helmet, CORS, Rate Limiting

## 🚀 Quick Start

### Prerequisites

1. **Node.js** (v16+)
2. **Deepgram API Key** ([Get one here](https://deepgram.com))
3. **Twilio Account** ([Sign up](https://twilio.com))
4. **DigitalOcean Account** ([Create account](https://digitalocean.com))

### Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/deepgram-ai-phone-platform.git
   cd deepgram-ai-phone-platform
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your API keys:
   ```env
   DEEPGRAM_API_KEY=your_deepgram_api_key_here
   TWILIO_ACCOUNT_SID=your_twilio_account_sid
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_PHONE_NUMBER=+1234567890
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

5. **Configure Twilio webhook**
   
   In your Twilio Console:
   - Go to Phone Numbers → Manage → Active numbers
   - Select your phone number
   - Set webhook URL to: `https://your-domain.com/webhook/call`
   - Method: HTTP POST

## 🌐 DigitalOcean Deployment

### One-Click Deploy

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/yourusername/deepgram-ai-phone-platform/tree/main)

### Manual Deployment

1. **Fork this repository**

2. **Create new App on DigitalOcean**
   ```bash
   doctl apps create .do/app.yaml
   ```

3. **Set environment variables** in DO console:
   - `DEEPGRAM_API_KEY`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
   - `OPENAI_API_KEY` (optional)
   - `JWT_SECRET`
   - `ENCRYPTION_KEY`

4. **Update Twilio webhook** with your DO app URL

## 📞 How It Works

### Call Flow

1. **Incoming Call** → Twilio receives call
2. **Webhook Trigger** → Twilio sends webhook to your app
3. **WebSocket Connection** → Real-time audio stream established
4. **AI Greeting** → Aura 2 (Odysseus) speaks welcome message
5. **Conversation Loop**:
   - User speaks → Deepgram STT → AI Processing → Deepgram TTS → User hears response
6. **Call Analytics** → Full conversation logged

### API Endpoints

- `POST /webhook/call` - Twilio webhook for incoming calls
- `GET /api/calls` - List all calls
- `GET /api/calls/:callSid` - Get specific call details
- `POST /api/configure` - Update AI agent configuration
- `GET /health` - Health check endpoint

## 🤖 AI Agent Configuration

### Default Configuration

```javascript
const agentConfig = {
  voice: 'aura-odysseus-en',           // Deepgram Aura 2 Odysseus voice
  greeting: 'Hello! Thank you for calling...', // Custom greeting
  prompt: 'You are a professional AI assistant...', // AI behavior
  maxCallDuration: 600,                // 10 minutes max
  enableRecording: true,               // Record conversations
  enableTranscription: true            // Save transcripts
};
```

### Customizing AI Behavior

```javascript
// Update agent configuration via API
POST /api/configure
{
  "callSid": "CA123456789",
  "config": {
    "greeting": "Welcome to Acme Corp! How can I help?",
    "prompt": "You are a sales assistant for Acme Corp. Be enthusiastic and helpful.",
    "voice": "aura-odysseus-en"
  }
}
```

## 💼 For Resellers

### White-Label Setup

1. **Customize branding** in `package.json`
2. **Update company info** in environment variables
3. **Configure custom domain** in DigitalOcean
4. **Set up billing integration** (Stripe, etc.)
5. **Add customer management** system

### Pricing Tiers

- **Starter**: 100 minutes/month - $29/month
- **Professional**: 500 minutes/month - $99/month  
- **Enterprise**: Unlimited - $299/month

*(Customize based on your business model)*

## 📊 Monitoring & Analytics

### Built-in Metrics

- Call duration
- Conversation transcripts
- AI response times
- Error rates
- Customer satisfaction scores

### Integration Options

- **Analytics**: Google Analytics, Mixpanel
- **Monitoring**: Datadog, New Relic
- **Logging**: LogRocket, Sentry
- **CRM**: Salesforce, HubSpot

## 🔒 Security Features

- ✅ **HTTPS Enforced**
- ✅ **Rate Limiting** (100 requests/15 minutes)
- ✅ **CORS Protection**
- ✅ **Input Validation**
- ✅ **Secret Management**
- ✅ **Encrypted Storage**
- ✅ **Audit Logging**

## 📈 Scaling

### Auto-Scaling (DigitalOcean)

- **Min instances**: 1
- **Max instances**: 5
- **CPU threshold**: 70%
- **Memory threshold**: 80%

### Performance Optimization

- WebSocket connection pooling
- Audio stream compression
- Response caching
- Database query optimization

## 🛠️ Development

### Local Testing

```bash
# Run tests
npm test

# Start with nodemon
npm run dev

# Lint code
npm run lint

# Format code
npm run format
```

### Adding Features

1. Fork the repository
2. Create feature branch
3. Add tests
4. Submit pull request

## 📚 API Documentation

### Call Management

```javascript
// Get all active calls
GET /api/calls

// Get specific call
GET /api/calls/CA123456789

// Configure AI agent
POST /api/configure
{
  "callSid": "CA123456789",
  "config": {
    "voice": "aura-odysseus-en",
    "greeting": "Custom greeting",
    "prompt": "Custom AI behavior"
  }
}
```

### WebSocket Events

```javascript
// Audio stream events
{
  "event": "media",
  "media": {
    "payload": "base64_audio_data"
  }
}

// Call status events
{
  "event": "start",
  "callSid": "CA123456789"
}
```

## 🤝 Support

- 📧 **Email**: support@yourcompany.com
- 💬 **Discord**: [Join our community](https://discord.gg/yourserver)
- 📖 **Docs**: [Full documentation](https://docs.yourcompany.com)
- 🐛 **Issues**: [GitHub Issues](https://github.com/yourusername/deepgram-ai-phone-platform/issues)

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🌟 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md)

---

**Built with ❤️ for the AI community**

*Ready to transform your customer communication with AI? Deploy now and start selling!*

