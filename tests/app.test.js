const request = require('supertest');
const app = require('../app');
const AgentManager = require('../src/agents/AgentManager');
const ResellerManager = require('../src/reseller/ResellerManager');

describe('Deepgram AI Phone Platform', () => {
  let agentManager;
  let resellerManager;

  beforeEach(() => {
    agentManager = new AgentManager();
    resellerManager = new ResellerManager();
  });

  describe('Health Check', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(String)
      });
    });
  });

  describe('API Endpoints', () => {
    test('GET /api/calls should return empty calls list', async () => {
      const response = await request(app)
        .get('/api/calls')
        .expect(200);

      expect(response.body).toEqual({ calls: [] });
    });

    test('GET /api/calls/:callSid should return 404 for non-existent call', async () => {
      await request(app)
        .get('/api/calls/non-existent-call')
        .expect(404);
    });

    test('POST /api/configure should validate input', async () => {
      const response = await request(app)
        .post('/api/configure')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Webhook Endpoints', () => {
    test('POST /webhook/call should create TwiML response', async () => {
      const twilioRequest = {
        CallSid: 'CA1234567890abcdef',
        From: '+1234567890',
        To: '+0987654321'
      };

      const response = await request(app)
        .post('/webhook/call')
        .send(twilioRequest)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/text\/xml/);
      expect(response.text).toContain('<Response>');
      expect(response.text).toContain('<Connect>');
      expect(response.text).toContain('<Stream>');
    });
  });
});

describe('Agent Manager', () => {
  let agentManager;

  beforeEach(() => {
    agentManager = new AgentManager();
  });

  describe('Agent Creation', () => {
    test('should create agent from template', () => {
      const agent = agentManager.createAgent('customer-service');

      expect(agent).toHaveProperty('id');
      expect(agent.templateId).toBe('customer-service');
      expect(agent.name).toBe('Customer Service Agent');
      expect(agent.voice).toBe('aura-odysseus-en');
      expect(agent.status).toBe('active');
    });

    test('should throw error for invalid template', () => {
      expect(() => {
        agentManager.createAgent('invalid-template');
      }).toThrow('Template \'invalid-template\' not found');
    });

    test('should allow custom configuration', () => {
      const customConfig = {
        greeting: 'Custom greeting message',
        maxCallDuration: 1200
      };

      const agent = agentManager.createAgent('sales', customConfig);

      expect(agent.greeting).toBe('Custom greeting message');
      expect(agent.maxCallDuration).toBe(1200);
    });
  });

  describe('Agent Management', () => {
    test('should update agent configuration', () => {
      const agent = agentManager.createAgent('technical-support');
      const updates = {
        greeting: 'Updated greeting',
        status: 'inactive'
      };

      const updatedAgent = agentManager.updateAgent(agent.id, updates);

      expect(updatedAgent.greeting).toBe('Updated greeting');
      expect(updatedAgent.status).toBe('inactive');
      expect(updatedAgent).toHaveProperty('updatedAt');
    });

    test('should delete agent', () => {
      const agent = agentManager.createAgent('appointment-booking');
      
      const result = agentManager.deleteAgent(agent.id);
      
      expect(result).toBe(true);
      expect(agentManager.getAgent(agent.id)).toBeUndefined();
    });

    test('should list agents with filters', () => {
      agentManager.createAgent('customer-service');
      const inactiveAgent = agentManager.createAgent('sales');
      agentManager.updateAgent(inactiveAgent.id, { status: 'inactive' });

      const allAgents = agentManager.listAgents();
      const activeAgents = agentManager.listAgents({ status: 'active' });
      const salesAgents = agentManager.listAgents({ templateId: 'sales' });

      expect(allAgents).toHaveLength(2);
      expect(activeAgents).toHaveLength(1);
      expect(salesAgents).toHaveLength(1);
    });
  });

  describe('Agent Selection', () => {
    test('should select best performing agent', () => {
      const agent1 = agentManager.createAgent('customer-service');
      const agent2 = agentManager.createAgent('customer-service');

      // Update metrics to make agent2 perform better
      agentManager.updateAgentMetrics(agent1.id, {
        duration: 120,
        satisfactionScore: 3
      });
      agentManager.updateAgentMetrics(agent2.id, {
        duration: 180,
        satisfactionScore: 5
      });

      const selectedAgent = agentManager.getAgentForCall({
        templateId: 'customer-service'
      });

      expect(selectedAgent.id).toBe(agent2.id);
    });

    test('should return null when no agents available', () => {
      const selectedAgent = agentManager.getAgentForCall({
        templateId: 'non-existent'
      });

      expect(selectedAgent).toBeNull();
    });
  });

  describe('Templates', () => {
    test('should return all available templates', () => {
      const templates = agentManager.getTemplates();

      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      
      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('customer-service');
      expect(templateIds).toContain('sales');
      expect(templateIds).toContain('technical-support');
    });

    test('should add custom template', () => {
      const customTemplate = {
        name: 'Custom Agent',
        voice: 'aura-odysseus-en',
        greeting: 'Hello from custom agent',
        prompt: 'You are a custom agent'
      };

      agentManager.addTemplate('custom', customTemplate);
      
      const templates = agentManager.getTemplates();
      const customTemplateFound = templates.find(t => t.id === 'custom');
      
      expect(customTemplateFound).toBeDefined();
      expect(customTemplateFound.name).toBe('Custom Agent');
    });
  });
});

describe('Reseller Manager', () => {
  let resellerManager;

  beforeEach(() => {
    resellerManager = new ResellerManager();
  });

  describe('Reseller Creation', () => {
    test('should create reseller with valid data', () => {
      const companyData = {
        name: 'Test Company',
        website: 'https://test.com',
        email: 'contact@test.com',
        phone: '+1234567890',
        contactFirstName: 'John',
        contactLastName: 'Doe',
        contactEmail: 'john@test.com',
        contactPhone: '+1234567890'
      };

      const reseller = resellerManager.createReseller(companyData);

      expect(reseller).toHaveProperty('id');
      expect(reseller).toHaveProperty('apiKey');
      expect(reseller).toHaveProperty('secretKey');
      expect(reseller.company.name).toBe('Test Company');
      expect(reseller.subscription.tier).toBe('reseller');
      expect(reseller.status).toBe('active');
    });
  });

  describe('Customer Management', () => {
    test('should create customer for reseller', () => {
      const reseller = resellerManager.createReseller({
        name: 'Test Reseller',
        email: 'reseller@test.com',
        contactFirstName: 'Jane',
        contactLastName: 'Smith'
      });

      const customerData = {
        companyName: 'Customer Corp',
        email: 'customer@corp.com',
        firstName: 'Bob',
        lastName: 'Wilson',
        tier: 'professional'
      };

      const customer = resellerManager.createCustomer(reseller.id, customerData);

      expect(customer).toHaveProperty('id');
      expect(customer.resellerId).toBe(reseller.id);
      expect(customer.company.name).toBe('Customer Corp');
      expect(customer.subscription.tier).toBe('professional');
    });

    test('should track usage for customer', () => {
      const reseller = resellerManager.createReseller({
        name: 'Test Reseller',
        email: 'reseller@test.com',
        contactFirstName: 'Jane',
        contactLastName: 'Smith'
      });

      const customer = resellerManager.createCustomer(reseller.id, {
        companyName: 'Customer Corp',
        email: 'customer@corp.com',
        firstName: 'Bob',
        lastName: 'Wilson'
      });

      const callData = {
        duration: 300 // 5 minutes
      };

      resellerManager.trackUsage(customer.id, callData);

      const updatedCustomer = resellerManager.customers.get(customer.id);
      expect(updatedCustomer.usage.currentMonthMinutes).toBe(5);
      expect(updatedCustomer.usage.totalMinutes).toBe(5);
      expect(updatedCustomer.usage.currentMonthCost).toBeGreaterThan(0);
    });
  });

  describe('Pricing Tiers', () => {
    test('should have correct pricing structure', () => {
      const tiers = resellerManager.pricingTiers;

      expect(tiers.starter.monthlyMinutes).toBe(100);
      expect(tiers.starter.pricePerMonth).toBe(29);
      expect(tiers.professional.monthlyMinutes).toBe(500);
      expect(tiers.enterprise.monthlyMinutes).toBe('unlimited');
      expect(tiers.reseller.revenueShare).toBe(0.30);
    });
  });

  describe('API Key Validation', () => {
    test('should validate reseller API key', () => {
      const reseller = resellerManager.createReseller({
        name: 'Test Reseller',
        email: 'reseller@test.com',
        contactFirstName: 'Jane',
        contactLastName: 'Smith'
      });

      const validation = resellerManager.validateApiKey(reseller.apiKey);

      expect(validation).toBeDefined();
      expect(validation.type).toBe('reseller');
      expect(validation.id).toBe(reseller.id);
    });

    test('should validate customer API key', () => {
      const reseller = resellerManager.createReseller({
        name: 'Test Reseller',
        email: 'reseller@test.com',
        contactFirstName: 'Jane',
        contactLastName: 'Smith'
      });

      const customer = resellerManager.createCustomer(reseller.id, {
        companyName: 'Customer Corp',
        email: 'customer@corp.com',
        firstName: 'Bob',
        lastName: 'Wilson'
      });

      const validation = resellerManager.validateApiKey(customer.apiCredentials.apiKey);

      expect(validation).toBeDefined();
      expect(validation.type).toBe('customer');
      expect(validation.id).toBe(customer.id);
    });

    test('should return null for invalid API key', () => {
      const validation = resellerManager.validateApiKey('invalid-key');
      expect(validation).toBeNull();
    });
  });
});

