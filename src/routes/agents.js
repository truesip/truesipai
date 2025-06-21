const express = require('express');
const { AIAgent } = require('../database/models');
const router = express.Router();

// Get all agents for a user
router.get('/', async (req, res) => {
  try {
    const agents = await AIAgent.findAll({
      where: { userId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    
    res.json({ agents });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Get a specific agent
router.get('/:id', async (req, res) => {
  try {
    const agent = await AIAgent.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    res.json({ agent });
  } catch (error) {
    console.error('Error fetching agent:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
  }
});

// Create a new AI agent
router.post('/', async (req, res) => {
  try {
    const {
      agentName,
      agentDescription,
      agentDepartment,
      voice,
      personalities,
      greeting,
      maxDuration,
      responseStyle,
      systemPrompt,
      knowledgeBase,
      escalationRules
    } = req.body;
    
    // Validate required fields
    if (!agentName) {
      return res.status(400).json({ error: 'Agent name is required' });
    }
    
    // Build the system prompt based on inputs
    const fullPrompt = buildSystemPrompt({
      agentName,
      agentDepartment,
      personalities,
      responseStyle,
      systemPrompt,
      knowledgeBase,
      escalationRules
    });
    
    const agent = await AIAgent.create({
      userId: req.user.id,
      name: agentName,
      greeting: greeting || `Hello! Thank you for calling. I'm ${agentName}. How can I help you today?`,
      prompt: fullPrompt,
      voice: voice || 'aura-odysseus-en',
      maxCallDuration: parseInt(maxDuration) || 600,
      enableRecording: true,
      enableTranscription: true,
      isActive: true,
      // Store additional metadata
      metadata: {
        description: agentDescription,
        department: agentDepartment,
        personalities: personalities || [],
        responseStyle: responseStyle || 'concise',
        knowledgeBase,
        escalationRules
      }
    });
    
    res.status(201).json({ 
      success: true, 
      message: 'AI Agent created successfully',
      agent 
    });
    
  } catch (error) {
    console.error('Error creating agent:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// Update an existing agent
router.put('/:id', async (req, res) => {
  try {
    const agent = await AIAgent.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const {
      agentName,
      agentDescription,
      agentDepartment,
      voice,
      personalities,
      greeting,
      maxDuration,
      responseStyle,
      systemPrompt,
      knowledgeBase,
      escalationRules,
      isActive
    } = req.body;
    
    // Build updated system prompt
    const fullPrompt = buildSystemPrompt({
      agentName: agentName || agent.name,
      agentDepartment,
      personalities,
      responseStyle,
      systemPrompt,
      knowledgeBase,
      escalationRules
    });
    
    await agent.update({
      name: agentName || agent.name,
      greeting: greeting || agent.greeting,
      prompt: fullPrompt,
      voice: voice || agent.voice,
      maxCallDuration: parseInt(maxDuration) || agent.maxCallDuration,
      isActive: isActive !== undefined ? isActive : agent.isActive,
      metadata: {
        ...agent.metadata,
        description: agentDescription,
        department: agentDepartment,
        personalities: personalities || [],
        responseStyle: responseStyle,
        knowledgeBase,
        escalationRules
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Agent updated successfully',
      agent 
    });
    
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Delete an agent
router.delete('/:id', async (req, res) => {
  try {
    const agent = await AIAgent.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    await agent.destroy();
    
    res.json({ 
      success: true, 
      message: 'Agent deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting agent:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

// Toggle agent active status
router.patch('/:id/toggle', async (req, res) => {
  try {
    const agent = await AIAgent.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    await agent.update({ isActive: !agent.isActive });
    
    res.json({ 
      success: true, 
      message: `Agent ${agent.isActive ? 'activated' : 'deactivated'} successfully`,
      agent 
    });
    
  } catch (error) {
    console.error('Error toggling agent:', error);
    res.status(500).json({ error: 'Failed to toggle agent status' });
  }
});

// Test agent (simulate conversation)
router.post('/:id/test', async (req, res) => {
  try {
    const agent = await AIAgent.findOne({
      where: { 
        id: req.params.id,
        userId: req.user.id
      }
    });
    
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    
    const { message } = req.body;
    
    // Simulate AI response (in production, this would call OpenAI)
    const response = {
      agentResponse: `This is a test response from ${agent.name}. In a real call, I would respond to: "${message}"`,
      voice: agent.voice,
      greeting: agent.greeting
    };
    
    res.json({ 
      success: true, 
      test: response
    });
    
  } catch (error) {
    console.error('Error testing agent:', error);
    res.status(500).json({ error: 'Failed to test agent' });
  }
});

// Helper function to build system prompt
function buildSystemPrompt(config) {
  const {
    agentName,
    agentDepartment,
    personalities = [],
    responseStyle,
    systemPrompt,
    knowledgeBase,
    escalationRules
  } = config;
  
  let prompt = systemPrompt || `You are ${agentName}, an AI assistant.`;
  
  // Add department-specific instructions
  const departmentInstructions = {
    'customer-service': 'You specialize in customer service. Be helpful, patient, and focused on resolving customer issues.',
    'sales': 'You are a sales assistant. Be enthusiastic, knowledgeable about products, and guide customers toward making purchases.',
    'support': 'You provide technical support. Be precise, ask diagnostic questions, and provide step-by-step solutions.',
    'appointments': 'You handle appointment booking. Be efficient, check availability, and confirm details accurately.',
    'information': 'You provide information services. Be informative, accurate, and help callers find what they need.',
    'reception': 'You are a virtual receptionist. Be professional, route calls appropriately, and provide basic company information.'
  };
  
  if (departmentInstructions[agentDepartment]) {
    prompt += `\n\n${departmentInstructions[agentDepartment]}`;
  }
  
  // Add personality traits
  if (personalities.length > 0) {
    prompt += `\n\nPersonality traits: Be ${personalities.join(', ')}.`;
  }
  
  // Add response style
  if (responseStyle) {
    const styleInstructions = {
      'concise': 'Keep responses brief and to the point.',
      'detailed': 'Provide thorough and comprehensive responses.',
      'conversational': 'Be casual and conversational in tone.',
      'formal': 'Maintain a professional and formal tone.'
    };
    
    if (styleInstructions[responseStyle]) {
      prompt += `\n\n${styleInstructions[responseStyle]}`;
    }
  }
  
  // Add knowledge base
  if (knowledgeBase) {
    prompt += `\n\nKnowledge Base:\n${knowledgeBase}`;
  }
  
  // Add escalation rules
  if (escalationRules) {
    prompt += `\n\nEscalation Rules: ${escalationRules}`;
  }
  
  // Add general guidelines
  prompt += `\n\nGeneral Guidelines:
- Always be helpful and professional
- Listen carefully to customer needs
- If you don't know something, admit it honestly
- Keep responses under 30 seconds when possible
- End responses with a question to keep the conversation flowing`;
  
  return prompt;
}

module.exports = router;

