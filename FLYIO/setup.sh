#!/bin/bash

# 🚀 Fly.io Setup Script for Financial Advisor App
# This script automates the initial setup and deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Header
echo -e "${GREEN}"
echo "========================================="
echo "  Financial Advisor Fly.io Setup Script"
echo "  Deploying to Mumbai Region (India)"
echo "========================================="
echo -e "${NC}"

# Step 1: Check for flyctl installation
print_status "Checking for Fly.io CLI installation..."
if ! command -v flyctl &> /dev/null && ! command -v fly &> /dev/null; then
    print_error "Fly.io CLI not found!"
    echo "Please install it first:"
    echo "  macOS: brew install flyctl"
    echo "  Linux: curl -L https://fly.io/install.sh | sh"
    echo "  Windows: powershell -Command \"iwr https://fly.io/install.ps1 -useb | iex\""
    exit 1
fi
print_success "Fly.io CLI found"

# Use fly or flyctl depending on what's available
FLY_CMD="fly"
if ! command -v fly &> /dev/null; then
    FLY_CMD="flyctl"
fi

# Step 2: Check authentication
print_status "Checking Fly.io authentication..."
if ! $FLY_CMD auth whoami &> /dev/null; then
    print_warning "Not logged in to Fly.io"
    print_status "Opening browser for login..."
    $FLY_CMD auth login
fi
print_success "Authenticated with Fly.io"

# Step 3: Get app name from user
print_status "Setting up your app..."
echo -n "Enter your app name (lowercase, hyphens allowed): "
read APP_NAME

if [ -z "$APP_NAME" ]; then
    APP_NAME="financial-advisor-$(date +%s)"
    print_warning "No name provided, using: $APP_NAME"
fi

# Step 4: Navigate to project root
cd ..
print_status "Working in project root: $(pwd)"

# Step 5: Copy configuration files
print_status "Copying Fly.io configuration files..."
cp FLYIO/fly.toml ./fly.toml
cp FLYIO/Dockerfile ./Dockerfile
cp FLYIO/.dockerignore ./.dockerignore 2>/dev/null || true

# Update app name in fly.toml
sed -i.bak "s/app = \"financial-advisor-india\"/app = \"$APP_NAME\"/" fly.toml && rm fly.toml.bak
print_success "Configuration files copied"

# Step 6: Create the app
print_status "Creating Fly.io app in Mumbai region..."
if $FLY_CMD apps create $APP_NAME --region bom; then
    print_success "App created: $APP_NAME"
else
    print_warning "App might already exist, continuing..."
fi

# Step 7: Create volume for SQLite
print_status "Creating persistent volume for SQLite database..."
if $FLY_CMD volumes create sqlite_data --app $APP_NAME --region bom --size 1 --yes; then
    print_success "Volume created: sqlite_data (1GB)"
else
    print_warning "Volume might already exist, continuing..."
fi

# Step 8: Set secrets
print_status "Setting up environment variables..."
echo ""
echo "Please provide your API keys (they will be hidden):"
echo ""

# Function to set secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_PROMPT=$2
    
    echo -n "$SECRET_PROMPT: "
    read -s SECRET_VALUE
    echo ""
    
    if [ ! -z "$SECRET_VALUE" ]; then
        echo "$SECRET_VALUE" | $FLY_CMD secrets set $SECRET_NAME --app $APP_NAME --stage
        print_success "$SECRET_NAME set"
    else
        print_warning "$SECRET_NAME skipped (no value provided)"
    fi
}

# Set each secret
set_secret "ANTHROPIC_API_KEY" "Enter your Anthropic API key"
set_secret "ELEVENLABS_API_KEY" "Enter your ElevenLabs API key"
set_secret "NEXT_PUBLIC_ELEVENLABS_API_KEY" "Enter your ElevenLabs API key (public)"
set_secret "ELEVENLABS_AGENT_ID" "Enter your ElevenLabs Agent ID"
set_secret "ELEVENLABS_WEBHOOK_SECRET" "Enter your ElevenLabs Webhook Secret (or press Enter to skip)"

# Deploy secrets
print_status "Deploying secrets..."
$FLY_CMD secrets deploy --app $APP_NAME

# Step 9: Initial deployment
print_status "Starting initial deployment..."
echo "This may take 5-10 minutes for the first deployment..."
echo ""

if $FLY_CMD deploy --app $APP_NAME; then
    print_success "Deployment successful!"
else
    print_error "Deployment failed. Check the logs above for errors."
    echo "You can try deploying again with: fly deploy --app $APP_NAME"
    exit 1
fi

# Step 10: Show app info
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}       Deployment Complete! 🎉${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
print_success "Your app is live at: https://$APP_NAME.fly.dev"
echo ""
echo "Useful commands:"
echo "  View logs:        $FLY_CMD logs --app $APP_NAME"
echo "  Check status:     $FLY_CMD status --app $APP_NAME"
echo "  SSH to app:       $FLY_CMD ssh console --app $APP_NAME"
echo "  Open dashboard:   $FLY_CMD dashboard --app $APP_NAME"
echo ""
echo "Next steps:"
echo "  1. Test your app at https://$APP_NAME.fly.dev"
echo "  2. Configure custom domain (optional): $FLY_CMD certs add yourdomain.com --app $APP_NAME"
echo "  3. Set up regular backups: cd FLYIO && ./backup.sh"
echo ""
print_status "Setup complete! Your Financial Advisor app is running in Mumbai."