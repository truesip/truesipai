const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');
const crypto = require('crypto');

class ResellerManager extends EventEmitter {
  constructor() {
    super();
    this.resellers = new Map();
    this.customers = new Map();
    this.subscriptions = new Map();
    this.usageTracking = new Map();
    this.pricingTiers = this.initializePricingTiers();
  }

  initializePricingTiers() {
    return {
      'starter': {
        name: 'Starter Plan',
        monthlyMinutes: 100,
        pricePerMonth: 29,
        pricePerMinute: 0.15,
        maxConcurrentCalls: 2,
        features: [
          'Basic AI Voice Agent',
          'Call Recording',
          'Basic Analytics',
          'Email Support'
        ],
        restrictions: {
          customPrompts: false,
          apiAccess: false,
          whiteLabel: false
        }
      },
      'professional': {
        name: 'Professional Plan',
        monthlyMinutes: 500,
        pricePerMonth: 99,
        pricePerMinute: 0.12,
        maxConcurrentCalls: 5,
        features: [
          'Advanced AI Voice Agent',
          'Custom Prompts & Greetings',
          'Call Recording & Transcription',
          'Advanced Analytics',
          'CRM Integration',
          'Priority Support'
        ],
        restrictions: {
          customPrompts: true,
          apiAccess: true,
          whiteLabel: false
        }
      },
      'enterprise': {
        name: 'Enterprise Plan',
        monthlyMinutes: 'unlimited',
        pricePerMonth: 299,
        pricePerMinute: 0.08,
        maxConcurrentCalls: 25,
        features: [
          'Premium AI Voice Agent (Aura 2)',
          'Unlimited Custom Agents',
          'Full API Access',
          'White-label Solution',
          'Custom Integrations',
          'Dedicated Account Manager',
          '24/7 Priority Support'
        ],
        restrictions: {
          customPrompts: true,
          apiAccess: true,
          whiteLabel: true
        }
      },
      'reseller': {
        name: 'Reseller Plan',
        monthlyMinutes: 'unlimited',
        pricePerMonth: 499,
        pricePerMinute: 0.05,
        maxConcurrentCalls: 100,
        features: [
          'All Enterprise Features',
          'Multi-tenant Management',
          'Customer Billing System',
          'Revenue Sharing',
          'Branded Portal',
          'Training & Onboarding'
        ],
        restrictions: {
          customPrompts: true,
          apiAccess: true,
          whiteLabel: true,
          multiTenant: true
        },
        revenueShare: 0.30 // 30% revenue share
      }
    };
  }

  createReseller(companyData) {
    const resellerId = uuidv4();
    const apiKey = this.generateApiKey();
    const secretKey = this.generateSecretKey();

    const reseller = {
      id: resellerId,
      apiKey,
      secretKey,
      company: {
        name: companyData.name,
        website: companyData.website,
        email: companyData.email,
        phone: companyData.phone,
        address: companyData.address
      },
      contact: {
        firstName: companyData.contactFirstName,
        lastName: companyData.contactLastName,
        email: companyData.contactEmail,
        phone: companyData.contactPhone,
        title: companyData.contactTitle
      },
      subscription: {
        tier: 'reseller',
        status: 'active',
        startDate: new Date(),
        nextBillingDate: this.getNextBillingDate(),
        autoRenew: true
      },
      branding: {
        logo: null,
        primaryColor: '#007bff',
        secondaryColor: '#6c757d',
        customDomain: null,
        companyName: companyData.name
      },
      settings: {
        allowCustomerSignup: true,
        requireApproval: true,
        defaultTier: 'starter',
        maxCustomers: 100,
        revenueShareEnabled: true
      },
      metrics: {
        totalCustomers: 0,
        totalRevenue: 0,
        monthlyRevenue: 0,
        totalMinutesUsed: 0,
        averageCustomerValue: 0
      },
      customers: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };

    this.resellers.set(resellerId, reseller);
    this.emit('resellerCreated', reseller);
    return reseller;
  }

  createCustomer(resellerId, customerData) {
    const reseller = this.resellers.get(resellerId);
    if (!reseller) {
      throw new Error('Reseller not found');
    }

    const customerId = uuidv4();
    const customer = {
      id: customerId,
      resellerId,
      company: {
        name: customerData.companyName,
        email: customerData.email,
        phone: customerData.phone,
        website: customerData.website
      },
      contact: {
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        email: customerData.contactEmail || customerData.email,
        phone: customerData.contactPhone || customerData.phone
      },
      subscription: {
        tier: customerData.tier || reseller.settings.defaultTier,
        status: reseller.settings.requireApproval ? 'pending' : 'active',
        startDate: new Date(),
        nextBillingDate: this.getNextBillingDate(),
        autoRenew: true
      },
      usage: {
        currentMonthMinutes: 0,
        totalMinutes: 0,
        currentMonthCost: 0,
        totalCost: 0,
        lastUsageDate: null
      },
      agents: [],
      apiCredentials: {
        apiKey: this.generateApiKey(),
        secretKey: this.generateSecretKey()
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'active'
    };

    this.customers.set(customerId, customer);
    reseller.customers.push(customerId);
    reseller.metrics.totalCustomers++;
    
    this.resellers.set(resellerId, reseller);
    this.emit('customerCreated', { reseller, customer });
    
    return customer;
  }

  trackUsage(customerId, callData) {
    const customer = this.customers.get(customerId);
    if (!customer) return;

    const reseller = this.resellers.get(customer.resellerId);
    if (!reseller) return;

    const tier = this.pricingTiers[customer.subscription.tier];
    const minutesUsed = Math.ceil(callData.duration / 60);
    const cost = minutesUsed * tier.pricePerMinute;

    // Update customer usage
    customer.usage.currentMonthMinutes += minutesUsed;
    customer.usage.totalMinutes += minutesUsed;
    customer.usage.currentMonthCost += cost;
    customer.usage.totalCost += cost;
    customer.usage.lastUsageDate = new Date();

    // Update reseller metrics
    reseller.metrics.totalMinutesUsed += minutesUsed;
    reseller.metrics.monthlyRevenue += cost;
    reseller.metrics.totalRevenue += cost;
    
    // Calculate reseller revenue share
    if (reseller.settings.revenueShareEnabled) {
      const revenueShare = cost * tier.revenueShare;
      reseller.metrics.monthlyRevenue += revenueShare;
    }

    this.customers.set(customerId, customer);
    this.resellers.set(customer.resellerId, reseller);

    this.emit('usageTracked', { customer, reseller, callData, cost });
  }

  getResellerDashboard(resellerId) {
    const reseller = this.resellers.get(resellerId);
    if (!reseller) {
      throw new Error('Reseller not found');
    }

    const customers = reseller.customers.map(customerId => 
      this.customers.get(customerId)
    ).filter(Boolean);

    const activeCustomers = customers.filter(c => c.status === 'active').length;
    const pendingCustomers = customers.filter(c => c.subscription.status === 'pending').length;
    const totalMinutesThisMonth = customers.reduce((sum, c) => sum + c.usage.currentMonthMinutes, 0);
    const totalRevenueThisMonth = customers.reduce((sum, c) => sum + c.usage.currentMonthCost, 0);

    return {
      reseller: {
        id: reseller.id,
        company: reseller.company,
        subscription: reseller.subscription,
        branding: reseller.branding
      },
      metrics: {
        ...reseller.metrics,
        activeCustomers,
        pendingCustomers,
        totalMinutesThisMonth,
        totalRevenueThisMonth
      },
      customers: customers.map(customer => ({
        id: customer.id,
        company: customer.company,
        subscription: customer.subscription,
        usage: customer.usage,
        status: customer.status
      })),
      recentActivity: this.getRecentActivity(resellerId)
    };
  }

  getCustomerPortal(customerId) {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const reseller = this.resellers.get(customer.resellerId);
    const tier = this.pricingTiers[customer.subscription.tier];

    return {
      customer: {
        id: customer.id,
        company: customer.company,
        subscription: customer.subscription,
        usage: customer.usage,
        apiCredentials: customer.apiCredentials
      },
      pricing: tier,
      branding: reseller.branding,
      agents: customer.agents,
      usageHistory: this.getUsageHistory(customerId),
      billing: this.getBillingInfo(customerId)
    };
  }

  updateSubscription(customerId, newTier) {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    if (!this.pricingTiers[newTier]) {
      throw new Error('Invalid pricing tier');
    }

    const oldTier = customer.subscription.tier;
    customer.subscription.tier = newTier;
    customer.subscription.updatedAt = new Date();
    customer.updatedAt = new Date();

    this.customers.set(customerId, customer);
    this.emit('subscriptionUpdated', { customer, oldTier, newTier });

    return customer;
  }

  generateInvoice(customerId, period) {
    const customer = this.customers.get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const reseller = this.resellers.get(customer.resellerId);
    const tier = this.pricingTiers[customer.subscription.tier];

    const invoice = {
      id: uuidv4(),
      customerId,
      resellerId: customer.resellerId,
      period,
      lineItems: [
        {
          description: `${tier.name} - Monthly Subscription`,
          quantity: 1,
          unitPrice: tier.pricePerMonth,
          total: tier.pricePerMonth
        }
      ],
      subtotal: tier.pricePerMonth,
      tax: tier.pricePerMonth * 0.08, // 8% tax
      total: tier.pricePerMonth * 1.08,
      status: 'pending',
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdAt: new Date(),
      branding: reseller.branding
    };

    // Add usage charges if over plan limits
    if (customer.usage.currentMonthMinutes > tier.monthlyMinutes && tier.monthlyMinutes !== 'unlimited') {
      const overageMinutes = customer.usage.currentMonthMinutes - tier.monthlyMinutes;
      const overageCharge = overageMinutes * tier.pricePerMinute;
      
      invoice.lineItems.push({
        description: `Overage - ${overageMinutes} minutes`,
        quantity: overageMinutes,
        unitPrice: tier.pricePerMinute,
        total: overageCharge
      });

      invoice.subtotal += overageCharge;
      invoice.total = invoice.subtotal * 1.08;
    }

    return invoice;
  }

  generateApiKey() {
    return 'sk_' + crypto.randomBytes(32).toString('hex');
  }

  generateSecretKey() {
    return crypto.randomBytes(64).toString('hex');
  }

  getNextBillingDate() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  getRecentActivity(resellerId) {
    // This would integrate with your activity logging system
    return [
      {
        type: 'customer_signup',
        description: 'New customer signed up',
        timestamp: new Date(),
        details: { customerName: 'Acme Corp' }
      },
      {
        type: 'usage_spike',
        description: 'Customer exceeded 80% of plan limit',
        timestamp: new Date(Date.now() - 3600000),
        details: { customerName: 'TechStart Inc', usage: '420 minutes' }
      }
    ];
  }

  getUsageHistory(customerId) {
    // This would integrate with your usage tracking system
    return [
      {
        date: new Date(),
        minutes: 45,
        cost: 5.40,
        calls: 12
      },
      {
        date: new Date(Date.now() - 86400000),
        minutes: 32,
        cost: 3.84,
        calls: 8
      }
    ];
  }

  getBillingInfo(customerId) {
    const customer = this.customers.get(customerId);
    const tier = this.pricingTiers[customer.subscription.tier];
    
    return {
      currentPlan: tier.name,
      nextBillingDate: customer.subscription.nextBillingDate,
      currentUsage: customer.usage.currentMonthMinutes,
      planLimit: tier.monthlyMinutes,
      currentCharges: customer.usage.currentMonthCost,
      paymentMethod: 'Credit Card ending in 4242' // This would come from payment processor
    };
  }

  validateApiKey(apiKey) {
    // Check if API key belongs to a reseller
    for (const [resellerId, reseller] of this.resellers) {
      if (reseller.apiKey === apiKey) {
        return { type: 'reseller', id: resellerId, entity: reseller };
      }
    }

    // Check if API key belongs to a customer
    for (const [customerId, customer] of this.customers) {
      if (customer.apiCredentials.apiKey === apiKey) {
        return { type: 'customer', id: customerId, entity: customer };
      }
    }

    return null;
  }

  getResellerByDomain(domain) {
    for (const [resellerId, reseller] of this.resellers) {
      if (reseller.branding.customDomain === domain) {
        return reseller;
      }
    }
    return null;
  }
}

module.exports = ResellerManager;

