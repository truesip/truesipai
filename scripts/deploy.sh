#!/bin/bash

# DigitalOcean Deployment Script for Deepgram AI Phone Platform

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Deploying Deepgram AI Phone Platform to DigitalOcean...${NC}"
echo "================================================================"

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo -e "${RED}❌ DigitalOcean CLI (doctl) is not installed${NC}"
    echo "Please install doctl first:"
    echo "  - Download: https://github.com/digitalocean/doctl/releases"
    echo "  - Or install via package manager:"
    echo "    - macOS: brew install doctl"
    echo "    - Ubuntu: snap install doctl"
    exit 1
fi

# Check if user is authenticated
if ! doctl account get &> /dev/null; then
    echo -e "${RED}❌ Not authenticated with DigitalOcean${NC}"
    echo "Please authenticate with: doctl auth init"
    exit 1
fi

echo -e "${GREEN}✅ DigitalOcean CLI authenticated${NC}"

# Check if git repository is clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Warning: You have uncommitted changes${NC}"
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

# Check if .env file exists and has required variables
if [ ! -f ".env" ]; then
    echo -e "${RED}❌ .env file not found${NC}"
    echo "Please create .env file with required API keys"
    exit 1
fi

# Read required environment variables
echo -e "${BLUE}🔍 Checking environment variables...${NC}"

required_vars=("DEEPGRAM_API_KEY" "TWILIO_ACCOUNT_SID" "TWILIO_AUTH_TOKEN" "TWILIO_PHONE_NUMBER")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env || [ -z "$(grep "^$var=" .env | cut -d'=' -f2)" ]; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo -e "${RED}❌ Missing required environment variables:${NC}"
    printf '  - %s\n' "${missing_vars[@]}"
    echo "Please add these to your .env file"
    exit 1
fi

echo -e "${GREEN}✅ All required environment variables found${NC}"

# Get app name
read -p "Enter your app name (default: deepgram-ai-phone): " APP_NAME
APP_NAME=${APP_NAME:-deepgram-ai-phone}

# Get GitHub repository URL
GIT_REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$GIT_REMOTE" ]; then
    read -p "Enter your GitHub repository URL: " GIT_REMOTE
    if [ -z "$GIT_REMOTE" ]; then
        echo -e "${RED}❌ GitHub repository URL is required${NC}"
        exit 1
    fi
fi

echo -e "${BLUE}🔗 Using repository: $GIT_REMOTE${NC}"

# Create app specification from template
echo -e "${BLUE}📝 Creating app specification...${NC}"

# Update app.yaml with user-specific values
sed "s/yourusername\/deepgram-ai-phone-platform/${GIT_REMOTE#*github.com/}/g" .do/app.yaml > .do/app-deploy.yaml
sed -i "s/name: deepgram-ai-phone-platform/name: $APP_NAME/g" .do/app-deploy.yaml

# Deploy the app
echo -e "${BLUE}🚀 Creating DigitalOcean App...${NC}"

if doctl apps create .do/app-deploy.yaml; then
    echo -e "${GREEN}✅ App created successfully!${NC}"
else
    echo -e "${RED}❌ Failed to create app${NC}"
    exit 1
fi

# Get app ID
APP_ID=$(doctl apps list --format ID,Name --no-header | grep "$APP_NAME" | awk '{print $1}' | head -1)

if [ -z "$APP_ID" ]; then
    echo -e "${RED}❌ Could not find created app${NC}"
    exit 1
fi

echo -e "${BLUE}🆔 App ID: $APP_ID${NC}"

# Set environment variables
echo -e "${BLUE}🔑 Setting environment variables...${NC}"

# Read environment variables from .env file
while IFS='=' read -r key value; do
    # Skip comments and empty lines
    [[ $key =~ ^[[:space:]]*# ]] && continue
    [[ -z $key ]] && continue
    
    # Remove quotes if present
    value=$(echo "$value" | sed 's/^"\|"$//g')
    
    # Set environment variable for the app
    if [[ $key =~ ^(DEEPGRAM_API_KEY|TWILIO_ACCOUNT_SID|TWILIO_AUTH_TOKEN|TWILIO_PHONE_NUMBER|OPENAI_API_KEY|JWT_SECRET|ENCRYPTION_KEY)$ ]]; then
        echo "Setting $key..."
        doctl apps update $APP_ID --spec .do/app-deploy.yaml || echo "Warning: Could not update $key"
    fi
done < .env

# Wait for deployment
echo -e "${BLUE}⏳ Waiting for deployment to complete...${NC}"
echo "This may take a few minutes..."

# Monitor deployment status
for i in {1..30}; do
    STATUS=$(doctl apps get $APP_ID --format Phase --no-header)
    echo "Deployment status: $STATUS"
    
    if [ "$STATUS" = "RUNNING" ]; then
        echo -e "${GREEN}✅ Deployment completed successfully!${NC}"
        break
    elif [ "$STATUS" = "ERROR" ]; then
        echo -e "${RED}❌ Deployment failed${NC}"
        echo "Check the DigitalOcean console for error details"
        exit 1
    fi
    
    sleep 30
done

# Get app URL
APP_URL=$(doctl apps get $APP_ID --format DefaultIngress --no-header)

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo "================================================================"
echo -e "${BLUE}App Name:${NC} $APP_NAME"
echo -e "${BLUE}App ID:${NC} $APP_ID"
echo -e "${BLUE}App URL:${NC} https://$APP_URL"
echo ""
echo -e "${YELLOW}📝 Next steps:${NC}"
echo "1. Update your Twilio webhook URL to: https://$APP_URL/webhook/call"
echo "2. Test your deployment: https://$APP_URL/health"
echo "3. Monitor your app: https://cloud.digitalocean.com/apps/$APP_ID"
echo ""
echo -e "${BLUE}🔗 Useful commands:${NC}"
echo "  - View logs: doctl apps logs $APP_ID"
echo "  - Update app: doctl apps update $APP_ID --spec .do/app.yaml"
echo "  - Delete app: doctl apps delete $APP_ID"
echo ""
echo -e "${GREEN}🚀 Your AI Phone Platform is now live!${NC}"

# Clean up temporary file
rm -f .do/app-deploy.yaml

echo ""

