# 🔑 Real Admin Account Setup

## Create Your Own Admin Account (Not Demo)

Your platform now has **real authentication** instead of demo placeholders. Here's how to create your personalized admin account:

## 🚀 Quick Setup:

### Step 1: Create Your Admin Account

```powershell
node create-admin.js
```

Or use the npm script:

```powershell
npm run create-admin
```

**You'll be prompted for:**
- ✉️ Your admin email address
- 🔒 Your secure password 
- 👤 Your first and last name
- 🏢 Your company name

### Step 2: Start the Server

```powershell
npm start
```

### Step 3: Login to Admin Panel

1. Go to: http://localhost:3000/login
2. Use the email and password you just created
3. Access your admin dashboard

## 🔐 Admin Features:

✅ **User Management** - Create, edit, and manage user accounts
✅ **Call Monitoring** - View live and historical call data
✅ **AI Agent Configuration** - Customize AI behavior and responses
✅ **Subscription Management** - Manage user tiers and billing
✅ **Usage Analytics** - Track platform performance
✅ **API Key Management** - Generate and manage API keys
✅ **Reseller Dashboard** - Multi-tenant management

## 📊 Default Admin Permissions:

- Full user management access
- Call monitoring and analytics
- AI agent configuration
- System settings
- Billing and subscription management
- Unlimited call minutes
- Enterprise features

## 🛡️ Security Features:

✅ **Encrypted Passwords** - bcrypt with 12 salt rounds
✅ **JWT Authentication** - Secure session management
✅ **Rate Limiting** - Protection against brute force
✅ **Database Storage** - Real SQLite database (not in-memory)
✅ **API Key Security** - Unique API keys for each admin

## 🆚 Demo vs Real Admin:

| Feature | Demo Account | Real Admin Account |
|---------|-------------|-------------------|
| Authentication | Fake/Hardcoded | Real database authentication |
| Password | Fixed demo password | Your custom secure password |
| Data Storage | In-memory (lost on restart) | SQLite database (persistent) |
| User Management | Limited/Fake | Full CRUD operations |
| API Access | Demo only | Real API with rate limiting |
| Session Management | Basic | JWT with expiration |
| Security | Minimal | Enterprise-grade |

## 🚨 Troubleshooting:

**"Admin already exists"**
- Each email can only have one account
- Use a different email or delete the existing account

**"Database error"**
- Make sure you've run `npm install` first
- Check that the database file has write permissions

**"Can't login"**
- Verify you're using the exact email and password you created
- Check the console for any authentication errors

**"Forgot admin password"**
- Delete the database file: `database.sqlite`
- Run `node create-admin.js` again to create a new admin

## 🔄 Reset Admin Account:

If you need to reset your admin account:

```powershell
# Delete the database
Remove-Item database.sqlite

# Create a new admin account
node create-admin.js
```

## 🌟 Next Steps:

1. **Customize AI Behavior** - Edit prompts in the admin panel
2. **Add Team Members** - Create additional user accounts
3. **Configure Billing** - Set up subscription tiers
4. **Monitor Usage** - Track call analytics
5. **Deploy to Production** - Use your real domain

---

**🎉 You now have a real, secure admin account for your business platform!**

