const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

class AgentManager extends EventEmitter {
  constructor() {
    super();
    this.agents = new Map();
    this.templates = new Map();
    this.loadDefaultTemplates();
  }

  loadDefaultTemplates() {
    // Default agent templates for different use cases
    const templates = {
      'customer-service': {
        name: 'Customer Service Agent',
        voice: 'aura-odysseus-en',
        greeting: 'Hello! Thank you for calling. I\'m here to help you with any questions or concerns you may have. How can I assist you today?',
        prompt: `You are a professional customer service representative with the following guidelines:
        - Always be polite, patient, and helpful
        - Listen carefully to customer concerns
        - Provide clear and accurate information
        - If you don't know something, offer to find out or transfer to a specialist
        - Maintain a warm and professional tone
        - Keep responses concise but thorough
        - Always ask if there's anything else you can help with before ending`,
        maxCallDuration: 900, // 15 minutes
        enableRecording: true,
        enableTranscription: true,
        transferOptions: ['technical-support', 'billing', 'sales'],
        escalationKeywords: ['manager', 'supervisor', 'complaint', 'cancel']
      },

      'sales': {
        name: 'Sales Agent',
        voice: 'aura-odysseus-en',
        greeting: 'Hi there! Thanks for your interest in our products. I\'m excited to help you find the perfect solution for your needs. What brings you here today?',
        prompt: `You are an enthusiastic and knowledgeable sales representative:
        - Build rapport and understand customer needs first
        - Be enthusiastic but not pushy
        - Focus on benefits, not just features
        - Ask qualifying questions to understand their requirements
        - Provide tailored recommendations
        - Handle objections professionally
        - Guide towards next steps (demo, trial, purchase)
        - Always follow up on customer concerns`,
        maxCallDuration: 1200, // 20 minutes
        enableRecording: true,
        enableTranscription: true,
        transferOptions: ['technical-demo', 'pricing-specialist'],
        leadCaptureFields: ['name', 'email', 'company', 'phone', 'timeline']
      },

      'technical-support': {
        name: 'Technical Support Agent',
        voice: 'aura-odysseus-en',
        greeting: 'Hello! I\'m your technical support specialist. I\'m here to help resolve any technical issues you\'re experiencing. Can you describe the problem you\'re facing?',
        prompt: `You are a skilled technical support agent:
        - Ask specific diagnostic questions
        - Guide users through troubleshooting steps clearly
        - Explain technical concepts in simple terms
        - Be patient with non-technical users
        - Confirm understanding at each step
        - Document the issue and resolution
        - Escalate complex issues when appropriate
        - Follow up to ensure the issue is resolved`,
        maxCallDuration: 1800, // 30 minutes
        enableRecording: true,
        enableTranscription: true,
        transferOptions: ['senior-technical', 'engineering'],
        troubleshootingMode: true
      },

      'appointment-booking': {
        name: 'Appointment Booking Agent',
        voice: 'aura-odysseus-en',
        greeting: 'Hello! I\'m here to help you schedule an appointment. I can check availability and book you in for the service you need. What type of appointment are you looking for?',
        prompt: `You are an efficient appointment booking specialist:
        - Collect necessary information: name, phone, email, service type
        - Check availability and offer options
        - Confirm all details before booking
        - Provide confirmation numbers and next steps
        - Handle rescheduling and cancellation requests
        - Be flexible and accommodating with scheduling
        - Send confirmation details
        - Remind about preparation requirements`,
        maxCallDuration: 600, // 10 minutes
        enableRecording: true,
        enableTranscription: true,
        calendarIntegration: true,
        reminderSettings: true
      },

      'lead-qualification': {
        name: 'Lead Qualification Agent',
        voice: 'aura-odysseus-en',
        greeting: 'Hi! Thanks for your interest in our services. I\'d like to learn more about your needs to ensure we can provide the best solution for you. Do you have a few minutes to chat?',
        prompt: `You are a lead qualification specialist:
        - Qualify leads using BANT criteria (Budget, Authority, Need, Timeline)
        - Ask open-ended questions to understand pain points
        - Determine decision-making process
        - Assess fit for your solutions
        - Score leads based on qualification criteria
        - Schedule follow-ups with sales team for qualified leads
        - Nurture unqualified leads for future opportunities
        - Maintain friendly, consultative approach`,
        maxCallDuration: 900, // 15 minutes
        enableRecording: true,
        enableTranscription: true,
        leadScoringEnabled: true,
        crmIntegration: true
      }
    };

    for (const [key, template] of Object.entries(templates)) {
      this.templates.set(key, template);
    }
  }

  createAgent(templateId, customConfig = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }

    const agentId = uuidv4();
    const agent = {
      id: agentId,
      templateId,
      ...template,
      ...customConfig,
      createdAt: new Date(),
      status: 'active',
      callHistory: [],
      metrics: {
        totalCalls: 0,
        averageDuration: 0,
        successRate: 0,
        satisfactionScore: 0
      }
    };

    this.agents.set(agentId, agent);
    this.emit('agentCreated', agent);
    return agent;
  }

  getAgent(agentId) {
    return this.agents.get(agentId);
  }

  updateAgent(agentId, updates) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`);
    }

    Object.assign(agent, updates, { updatedAt: new Date() });
    this.agents.set(agentId, agent);
    this.emit('agentUpdated', agent);
    return agent;
  }

  deleteAgent(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`);
    }

    this.agents.delete(agentId);
    this.emit('agentDeleted', { agentId, agent });
    return true;
  }

  listAgents(filter = {}) {
    let agents = Array.from(this.agents.values());

    if (filter.status) {
      agents = agents.filter(agent => agent.status === filter.status);
    }

    if (filter.templateId) {
      agents = agents.filter(agent => agent.templateId === filter.templateId);
    }

    return agents;
  }

  getTemplates() {
    return Array.from(this.templates.entries()).map(([id, template]) => ({
      id,
      ...template
    }));
  }

  addTemplate(templateId, template) {
    this.templates.set(templateId, {
      ...template,
      createdAt: new Date()
    });
    this.emit('templateAdded', { templateId, template });
  }

  updateAgentMetrics(agentId, callData) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.callHistory.push(callData);
    agent.metrics.totalCalls++;
    
    // Calculate average duration
    const totalDuration = agent.callHistory.reduce((sum, call) => sum + call.duration, 0);
    agent.metrics.averageDuration = totalDuration / agent.metrics.totalCalls;

    // Calculate success rate (calls that didn't hang up immediately)
    const successfulCalls = agent.callHistory.filter(call => call.duration > 30).length;
    agent.metrics.successRate = (successfulCalls / agent.metrics.totalCalls) * 100;

    // Update satisfaction score if available
    if (callData.satisfactionScore) {
      const scores = agent.callHistory
        .filter(call => call.satisfactionScore)
        .map(call => call.satisfactionScore);
      agent.metrics.satisfactionScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }

    this.agents.set(agentId, agent);
    this.emit('metricsUpdated', { agentId, metrics: agent.metrics });
  }

  getAgentForCall(criteria = {}) {
    // Smart agent selection based on criteria
    let availableAgents = this.listAgents({ status: 'active' });

    // Filter by template if specified
    if (criteria.templateId) {
      availableAgents = availableAgents.filter(agent => agent.templateId === criteria.templateId);
    }

    // Filter by availability (not currently in max concurrent calls)
    availableAgents = availableAgents.filter(agent => {
      const activeCalls = agent.callHistory.filter(call => !call.endTime).length;
      return activeCalls < (agent.maxConcurrentCalls || 5);
    });

    if (availableAgents.length === 0) {
      return null;
    }

    // Select agent with best performance metrics
    availableAgents.sort((a, b) => {
      const scoreA = (a.metrics.successRate * 0.4) + (a.metrics.satisfactionScore * 0.6);
      const scoreB = (b.metrics.successRate * 0.4) + (b.metrics.satisfactionScore * 0.6);
      return scoreB - scoreA;
    });

    return availableAgents[0];
  }

  exportAgentData(agentId) {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent '${agentId}' not found`);
    }

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        templateId: agent.templateId,
        status: agent.status,
        createdAt: agent.createdAt,
        metrics: agent.metrics
      },
      callHistory: agent.callHistory,
      configuration: {
        voice: agent.voice,
        greeting: agent.greeting,
        prompt: agent.prompt,
        maxCallDuration: agent.maxCallDuration
      }
    };
  }
}

module.exports = AgentManager;

