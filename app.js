const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const VoiceResponse = require('twilio').twiml.VoiceResponse;
const { createClient } = require('@deepgram/sdk');
const WebSocket = require('ws');
const path = require('path');
require('dotenv').config();

// Import SaaS components
const AuthManager = require('./src/auth/AuthManager');
const AgentManager = require('./src/agents/AgentManager');
const ResellerManager = require('./src/reseller/ResellerManager');
const { createAuthRoutes } = require('./src/routes/auth');
const { createAdminRoutes } = require('./src/routes/admin');
const { authenticateToken, validateApiKey, requireActiveSubscription } = require('./src/middleware/auth');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    methods: ['GET', 'POST']
  }
});

// Security middleware with CSP configuration for admin panel
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'", 
        "'unsafe-inline'", // Allow inline scripts for admin panel
        "'unsafe-eval'"    // Allow eval for dynamic content
      ],
      scriptSrcAttr: ["'unsafe-inline'"], // Allow onclick handlers
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"], // Allow WebSocket connections
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    },
  },
  crossOriginEmbedderPolicy: false // Disable for WebSocket compatibility
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Initialize Deepgram with v3 syntax
const deepgram = createClient(process.env.DEEPGRAM_API_KEY || 'your-api-key');

// Initialize SaaS managers
const authManager = new AuthManager();
const agentManager = new AgentManager();
const resellerManager = new ResellerManager();

// Store active calls
const activeCalls = new Map();

// Default AI Agent Configuration
const DEFAULT_AGENT_CONFIG = {
  voice: 'aura-odysseus-en',
  greeting: 'Hello! Thank you for calling. I\'m your AI assistant. How can I help you today?',
  prompt: `You are a professional AI phone assistant. 
  - Be helpful, polite, and concise
  - Listen carefully to customer needs
  - Provide clear and accurate information
  - If you don't know something, say so honestly
  - Always maintain a professional tone
  - Keep responses under 30 seconds when possible`,
  maxCallDuration: 600, // 10 minutes
  enableRecording: true,
  enableTranscription: true
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Twilio webhook for incoming calls
app.post('/webhook/call', (req, res) => {
  const twiml = new VoiceResponse();
  const callSid = req.body.CallSid;
  const from = req.body.From;
  const to = req.body.To;

  console.log(`Incoming call: ${callSid} from ${from} to ${to}`);

  // Store call information
  activeCalls.set(callSid, {
    from,
    to,
    startTime: new Date(),
    status: 'active'
  });

  // Connect to WebSocket for real-time audio processing
  const connect = twiml.connect();
  connect.stream({
    url: `wss://${req.get('host')}/stream/${callSid}`,
    track: 'both_tracks'
  });

  res.type('text/xml');
  res.send(twiml.toString());
});

// WebSocket handler for audio streams
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  
  if (pathname.startsWith('/stream/')) {
    const callSid = pathname.split('/')[2];
    handleAudioStream(request, socket, head, callSid);
  }
});

function handleAudioStream(request, socket, head, callSid) {
  const wss = new WebSocket.Server({ noServer: true });
  
  wss.handleUpgrade(request, socket, head, (ws) => {
    console.log(`Audio stream connected for call: ${callSid}`);
    
    const callData = activeCalls.get(callSid) || {};
    const config = { ...DEFAULT_AGENT_CONFIG, ...callData.config };
    
    // Initialize Deepgram connection for this call
    const deepgramConnection = deepgram.listen.live({
      model: 'nova-2',
      language: 'en-US',
      smart_format: true,
      interim_results: true
    });

    let hasGreeted = false;
    let conversationBuffer = [];

    // Send greeting when call starts
    if (!hasGreeted) {
      setTimeout(() => {
        sendAIResponse(ws, config.greeting, config.voice);
        hasGreeted = true;
      }, 1000);
    }

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.event === 'media') {
          // Forward audio to Deepgram for transcription
          const audioData = Buffer.from(data.media.payload, 'base64');
          deepgramConnection.send(audioData);
        }
        
        if (data.event === 'start') {
          console.log(`Call started: ${callSid}`);
        }
      } catch (error) {
        console.error('Error processing message:', error);
      }
    });

    // Handle Deepgram transcription results
    deepgramConnection.on('transcriptReceived', async (transcript) => {
      const result = transcript.channel.alternatives[0];
      
      if (result && result.transcript && result.transcript.trim()) {
        console.log(`Transcription: ${result.transcript}`);
        
        if (!result.is_final) return; // Wait for final transcript
        
        conversationBuffer.push({
          role: 'user',
          content: result.transcript,
          timestamp: new Date()
        });

        // Generate AI response
        const aiResponse = await generateAIResponse(result.transcript, conversationBuffer, config);
        
        if (aiResponse) {
          conversationBuffer.push({
            role: 'assistant',
            content: aiResponse,
            timestamp: new Date()
          });
          
          // Send AI response as audio
          await sendAIResponse(ws, aiResponse, config.voice);
        }
      }
    });

    ws.on('close', () => {
      console.log(`Audio stream closed for call: ${callSid}`);
      deepgramConnection.finish();
      
      // Update call status
      const call = activeCalls.get(callSid);
      if (call) {
        call.status = 'completed';
        call.endTime = new Date();
        call.duration = call.endTime - call.startTime;
        call.conversation = conversationBuffer;
      }
    });

    deepgramConnection.on('error', (error) => {
      console.error('Deepgram error:', error);
    });
  });
}

async function generateAIResponse(userInput, conversationHistory, config) {
  try {
    // Simple AI response logic - in production, integrate with your preferred LLM
    const context = conversationHistory.slice(-5).map(msg => `${msg.role}: ${msg.content}`).join('\n');
    
    // For demo purposes, using a simple response system
    // In production, integrate with OpenAI, Anthropic, or other LLM providers
    const responses = {
      greeting: "Hello! How can I assist you today?",
      help: "I'm here to help you with any questions or concerns you might have.",
      default: "I understand. Let me help you with that. Could you provide more details?"
    };
    
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('hello') || lowerInput.includes('hi')) {
      return responses.greeting;
    } else if (lowerInput.includes('help') || lowerInput.includes('assist')) {
      return responses.help;
    } else {
      return responses.default;
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    return "I apologize, but I'm having trouble processing your request right now. Could you please try again?";
  }
}

async function sendAIResponse(ws, text, voice = 'aura-odysseus-en') {
  try {
    // Generate speech using Deepgram's TTS (v3 API)
    const response = await deepgram.speak.request(
      { text },
      {
        model: voice,
        encoding: 'mulaw',
        sample_rate: 8000
      }
    );

    const audioBuffer = await response.getBody();
    
    // Convert to base64 and send to Twilio
    const base64Audio = audioBuffer.toString('base64');
    
    const mediaMessage = {
      event: 'media',
      streamSid: 'unique-stream-id',
      media: {
        payload: base64Audio
      }
    };
    
    ws.send(JSON.stringify(mediaMessage));
  } catch (error) {
    console.error('Error sending AI response:', error);
  }
}

// API Routes for management
app.get('/api/calls', (req, res) => {
  const calls = Array.from(activeCalls.entries()).map(([callSid, data]) => ({
    callSid,
    ...data
  }));
  
  res.json({ calls });
});

app.get('/api/calls/:callSid', (req, res) => {
  const call = activeCalls.get(req.params.callSid);
  
  if (!call) {
    return res.status(404).json({ error: 'Call not found' });
  }
  
  res.json({ callSid: req.params.callSid, ...call });
});

// Configuration endpoint for agents
app.post('/api/configure', (req, res) => {
  const { callSid, config } = req.body;
  
  if (callSid && activeCalls.has(callSid)) {
    const call = activeCalls.get(callSid);
    call.config = { ...DEFAULT_AGENT_CONFIG, ...config };
    activeCalls.set(callSid, call);
    
    res.json({ success: true, message: 'Configuration updated' });
  } else {
    res.status(400).json({ error: 'Invalid call ID or call not found' });
  }
});

// Mount SaaS routes
app.use('/auth', createAuthRoutes(authManager));
app.use('/admin', createAdminRoutes(authManager, agentManager, resellerManager));

// Serve static files for dashboard
app.use('/dashboard', express.static(path.join(__dirname, 'public/dashboard')));
app.use('/admin-panel', express.static(path.join(__dirname, 'public/admin')));
app.use('/docs', express.static(path.join(__dirname, 'public/docs')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// Protected API routes
app.use('/api/agents', authenticateToken(authManager), requireActiveSubscription());
app.use('/api/reseller', authenticateToken(authManager));

// Serve the main landing page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Deepgram AI Phone Platform API',
    version: '1.0.0',
    features: [
      'AI Voice Agents with Aura 2 (Odysseus)',
      'VOIP Call Handling',
      'SaaS Multi-tenant Architecture',
      'Admin Dashboard',
      'Reseller Management'
    ],
    endpoints: {
      health: '/health',
      auth: '/auth',
      admin: '/admin',
      webhook: '/webhook/call',
      signup: '/auth/signup',
      login: '/auth/login'
    }
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 Deepgram AI Phone Platform (SaaS) running on port ${PORT}`);
  console.log(`📞 Webhook URL: http://localhost:${PORT}/webhook/call`);
  console.log(`🔊 Voice: Aura 2 (Odysseus)`);
  console.log(`🔑 Admin Login: admin@deepgram-ai.com / Admin123!@#`);
  console.log(`🏢 SaaS Features: User Management, Admin Dashboard, Reseller Portal`);
});

module.exports = app;

