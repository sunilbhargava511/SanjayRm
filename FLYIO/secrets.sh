#!/bin/bash

# 🔐 Secrets Management Script for Fly.io
# Helps manage environment variables and API keys

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
echo "  Fly.io Secrets Management"
echo "========================================="
echo -e "${NC}"

# Use fly or flyctl depending on what's available
FLY_CMD="fly"
if ! command -v fly &> /dev/null; then
    FLY_CMD="flyctl"
fi

# Get app name from fly.toml
cd ..
if [ -f "fly.toml" ]; then
    APP_NAME=$(grep '^app = ' fly.toml | cut -d'"' -f2)
    print_status "Managing secrets for app: $APP_NAME"
else
    print_error "fly.toml not found. Run setup.sh first."
    exit 1
fi
cd FLYIO

# Function to set or update a secret
set_secret() {
    local SECRET_NAME=$1
    local SECRET_PROMPT=$2
    local REQUIRED=$3
    
    echo ""
    if [ "$REQUIRED" = "required" ]; then
        echo -e "${YELLOW}[REQUIRED]${NC} $SECRET_PROMPT"
    else
        echo -e "${BLUE}[OPTIONAL]${NC} $SECRET_PROMPT"
    fi
    
    echo -n "Enter value (or press Enter to skip): "
    read -s SECRET_VALUE
    echo ""
    
    if [ ! -z "$SECRET_VALUE" ]; then
        echo "$SECRET_VALUE" | $FLY_CMD secrets set $SECRET_NAME --app $APP_NAME --stage
        print_success "$SECRET_NAME staged for update"
        return 0
    else
        if [ "$REQUIRED" = "required" ]; then
            print_error "$SECRET_NAME is required!"
            return 1
        else
            print_warning "$SECRET_NAME skipped"
            return 0
        fi
    fi
}

# Menu
while true; do
    echo ""
    echo "What would you like to do?"
    echo "  1) View current secrets"
    echo "  2) Set all secrets"
    echo "  3) Update specific secret"
    echo "  4) Import from .env file"
    echo "  5) Remove a secret"
    echo "  6) Deploy staged secrets"
    echo "  0) Exit"
    echo ""
    echo -n "Choice: "
    read CHOICE
    
    case $CHOICE in
        1)
            print_status "Current secrets:"
            $FLY_CMD secrets list --app $APP_NAME
            ;;
            
        2)
            print_status "Setting all secrets..."
            echo "Leave blank to keep existing values"
            
            ERRORS=0
            set_secret "ANTHROPIC_API_KEY" "Anthropic API key" "required" || ((ERRORS++))
            set_secret "ELEVENLABS_API_KEY" "ElevenLabs API key (server)" "required" || ((ERRORS++))
            set_secret "NEXT_PUBLIC_ELEVENLABS_API_KEY" "ElevenLabs API key (public)" "required" || ((ERRORS++))
            set_secret "ELEVENLABS_AGENT_ID" "ElevenLabs Agent ID" "required" || ((ERRORS++))
            set_secret "ELEVENLABS_WEBHOOK_SECRET" "ElevenLabs Webhook Secret" "optional"
            
            if [ $ERRORS -eq 0 ]; then
                print_status "Deploying secrets..."
                $FLY_CMD secrets deploy --app $APP_NAME
                print_success "All secrets updated!"
            else
                print_error "$ERRORS required secrets were not provided"
                print_warning "Secrets not deployed. Fix errors and try again."
            fi
            ;;
            
        3)
            echo ""
            echo "Which secret to update?"
            echo "  1) ANTHROPIC_API_KEY"
            echo "  2) ELEVENLABS_API_KEY"
            echo "  3) NEXT_PUBLIC_ELEVENLABS_API_KEY"
            echo "  4) ELEVENLABS_AGENT_ID"
            echo "  5) ELEVENLABS_WEBHOOK_SECRET"
            echo "  6) Custom secret"
            echo ""
            echo -n "Choice: "
            read SECRET_CHOICE
            
            case $SECRET_CHOICE in
                1) set_secret "ANTHROPIC_API_KEY" "Anthropic API key" "required" ;;
                2) set_secret "ELEVENLABS_API_KEY" "ElevenLabs API key (server)" "required" ;;
                3) set_secret "NEXT_PUBLIC_ELEVENLABS_API_KEY" "ElevenLabs API key (public)" "required" ;;
                4) set_secret "ELEVENLABS_AGENT_ID" "ElevenLabs Agent ID" "required" ;;
                5) set_secret "ELEVENLABS_WEBHOOK_SECRET" "ElevenLabs Webhook Secret" "optional" ;;
                6)
                    echo -n "Enter secret name: "
                    read CUSTOM_NAME
                    set_secret "$CUSTOM_NAME" "Value for $CUSTOM_NAME" "optional"
                    ;;
                *) print_error "Invalid choice" ;;
            esac
            
            if [ $? -eq 0 ]; then
                print_status "Deploying secret..."
                $FLY_CMD secrets deploy --app $APP_NAME
            fi
            ;;
            
        4)
            print_status "Import from .env file"
            echo -n "Enter path to .env file (default: ../.env.local): "
            read ENV_FILE
            
            if [ -z "$ENV_FILE" ]; then
                ENV_FILE="../.env.local"
            fi
            
            if [ -f "$ENV_FILE" ]; then
                print_status "Reading $ENV_FILE..."
                
                # Read .env file and set secrets
                while IFS='=' read -r key value; do
                    # Skip comments and empty lines
                    if [[ $key =~ ^#.*$ ]] || [ -z "$key" ]; then
                        continue
                    fi
                    
                    # Remove quotes from value
                    value="${value%\"}"
                    value="${value#\"}"
                    value="${value%\'}"
                    value="${value#\'}"
                    
                    # Only import specific keys
                    case $key in
                        ANTHROPIC_API_KEY|ELEVENLABS_API_KEY|NEXT_PUBLIC_ELEVENLABS_API_KEY|ELEVENLABS_AGENT_ID|ELEVENLABS_WEBHOOK_SECRET)
                            print_status "Importing $key"
                            echo "$value" | $FLY_CMD secrets set $key --app $APP_NAME --stage
                            ;;
                        *)
                            print_warning "Skipping $key (not a recognized secret)"
                            ;;
                    esac
                done < "$ENV_FILE"
                
                print_status "Deploying imported secrets..."
                $FLY_CMD secrets deploy --app $APP_NAME
                print_success "Secrets imported from $ENV_FILE"
            else
                print_error "File not found: $ENV_FILE"
            fi
            ;;
            
        5)
            print_status "Current secrets:"
            $FLY_CMD secrets list --app $APP_NAME
            echo ""
            echo -n "Enter secret name to remove: "
            read SECRET_TO_REMOVE
            
            if [ ! -z "$SECRET_TO_REMOVE" ]; then
                $FLY_CMD secrets unset $SECRET_TO_REMOVE --app $APP_NAME --stage
                $FLY_CMD secrets deploy --app $APP_NAME
                print_success "$SECRET_TO_REMOVE removed"
            fi
            ;;
            
        6)
            print_status "Deploying staged secrets..."
            $FLY_CMD secrets deploy --app $APP_NAME
            print_success "Secrets deployed!"
            ;;
            
        0)
            print_status "Exiting..."
            exit 0
            ;;
            
        *)
            print_error "Invalid choice"
            ;;
    esac
done