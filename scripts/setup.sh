#!/bin/bash

# Deepgram AI Phone Platform Setup Script
# This script sets up the complete environment for the AI phone platform

set -e

echo "🚀 Setting up Deepgram AI Phone Platform..."
echo "==========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js 16+ first.${NC}"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="16.0.0"
if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    echo -e "${GREEN}✅ Node.js version $NODE_VERSION detected${NC}"
else
    echo -e "${RED}❌ Node.js version 16+ required. Current version: $NODE_VERSION${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
fi

# Install dependencies
echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Dependencies installed successfully${NC}"
else
    echo -e "${RED}❌ Failed to install dependencies${NC}"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo -e "${BLUE}📝 Creating environment file...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  Please edit .env file with your API keys before running the application${NC}"
else
    echo -e "${GREEN}✅ Environment file already exists${NC}"
fi

# Create necessary directories
echo -e "${BLUE}📁 Creating directories...${NC}"
mkdir -p logs
mkdir -p recordings
mkdir -p tmp
mkdir -p data

# Set permissions
chmod 755 scripts/*.sh 2>/dev/null || true

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo -e "${BLUE}🔧 Initializing git repository...${NC}"
    git init
    git add .
    git commit -m "Initial commit: Deepgram AI Phone Platform"
fi

echo ""
echo -e "${GREEN}🎉 Setup completed successfully!${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "1. Edit .env file with your API keys:"
echo "   - DEEPGRAM_API_KEY (Get from: https://deepgram.com)"
echo "   - TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN (Get from: https://twilio.com)"
echo "   - TWILIO_PHONE_NUMBER (Your Twilio phone number)"
echo ""
echo "2. Start the development server:"
echo -e "   ${YELLOW}npm run dev${NC}"
echo ""
echo "3. Configure Twilio webhook:"
echo "   - Go to Twilio Console > Phone Numbers"
echo "   - Set webhook URL to: https://your-domain.com/webhook/call"
echo ""
echo "4. Deploy to DigitalOcean:"
echo -e "   ${YELLOW}./scripts/deploy.sh${NC}"
echo ""
echo -e "${GREEN}🔗 Useful links:${NC}"
echo "   - Deepgram Console: https://console.deepgram.com"
echo "   - Twilio Console: https://console.twilio.com"
echo "   - DigitalOcean Apps: https://cloud.digitalocean.com/apps"
echo ""
echo -e "${GREEN}📚 Documentation: README.md${NC}"
echo ""

