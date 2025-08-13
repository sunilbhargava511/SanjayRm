#!/bin/bash

# 🚀 Fly.io Deployment Script for Updates
# Use this script to deploy updates to your existing app

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
echo "  Financial Advisor Deployment Script"
echo "========================================="
echo -e "${NC}"

# Use fly or flyctl depending on what's available
FLY_CMD="fly"
if ! command -v fly &> /dev/null; then
    FLY_CMD="flyctl"
fi

# Step 1: Check for uncommitted changes
print_status "Checking for uncommitted changes..."
if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes:"
    git status --short
    echo ""
    echo -n "Continue with deployment? (y/n): "
    read CONTINUE
    if [ "$CONTINUE" != "y" ]; then
        print_error "Deployment cancelled"
        exit 1
    fi
fi

# Step 2: Run build test locally
print_status "Testing build locally..."
if npm run build; then
    print_success "Local build successful"
else
    print_error "Local build failed. Fix errors before deploying."
    exit 1
fi

# Step 3: Get app name from fly.toml
cd ..
APP_NAME=$(grep '^app = ' fly.toml | cut -d'"' -f2)
print_status "Deploying to app: $APP_NAME"

# Step 4: Check app status
print_status "Checking app status..."
if $FLY_CMD status --app $APP_NAME &> /dev/null; then
    print_success "App is accessible"
else
    print_error "Cannot access app. Make sure you're logged in and have access."
    exit 1
fi

# Step 5: Backup reminder
print_warning "Database Backup Reminder!"
echo -n "Have you backed up the database? (y/n): "
read BACKED_UP
if [ "$BACKED_UP" != "y" ]; then
    print_status "Running backup script..."
    cd FLYIO
    if [ -f "backup.sh" ]; then
        ./backup.sh
    else
        print_warning "Backup script not found. Continuing without backup..."
    fi
    cd ..
fi

# Step 6: Show current deployment
print_status "Current deployment info:"
$FLY_CMD releases list --app $APP_NAME --limit 1

# Step 7: Deploy
print_status "Starting deployment..."
echo "This may take 3-5 minutes..."
echo ""

# Deploy with strategy
if $FLY_CMD deploy --app $APP_NAME --strategy rolling; then
    print_success "Deployment successful!"
else
    print_error "Deployment failed!"
    echo ""
    echo "Rollback to previous version? (y/n): "
    read ROLLBACK
    if [ "$ROLLBACK" = "y" ]; then
        print_status "Rolling back to previous version..."
        PREVIOUS_VERSION=$($FLY_CMD releases list --app $APP_NAME --limit 2 | tail -1 | awk '{print $1}')
        $FLY_CMD deploy --app $APP_NAME --image registry.fly.io/$APP_NAME:$PREVIOUS_VERSION
    fi
    exit 1
fi

# Step 8: Health check
print_status "Running health check..."
sleep 5  # Wait for app to start

HEALTH_CHECK_URL="https://$APP_NAME.fly.dev/api/health"
if curl -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL | grep -q "200"; then
    print_success "Health check passed"
else
    print_warning "Health check endpoint not responding (this might be normal if not implemented)"
fi

# Step 9: Show deployment info
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}       Deployment Complete! 🎉${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
print_success "Your app has been updated: https://$APP_NAME.fly.dev"
echo ""
echo "Post-deployment commands:"
echo "  View logs:        $FLY_CMD logs --app $APP_NAME --tail"
echo "  Check status:     $FLY_CMD status --app $APP_NAME"
echo "  Monitor metrics:  $FLY_CMD dashboard --app $APP_NAME"
echo "  View releases:    $FLY_CMD releases list --app $APP_NAME"
echo ""

# Step 10: Monitor logs for errors
echo -n "Monitor logs for errors? (y/n): "
read MONITOR
if [ "$MONITOR" = "y" ]; then
    print_status "Monitoring logs (Ctrl+C to stop)..."
    $FLY_CMD logs --app $APP_NAME --tail
fi