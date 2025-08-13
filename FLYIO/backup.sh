#!/bin/bash

# 🗄️ Database Backup Script for Fly.io
# Backs up SQLite database from Fly.io volume

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
echo "  Database Backup Script"
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
    print_status "Backing up database for app: $APP_NAME"
else
    print_error "fly.toml not found. Run setup.sh first."
    exit 1
fi

# Create backups directory
BACKUP_DIR="FLYIO/backups"
mkdir -p $BACKUP_DIR

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/database_${TIMESTAMP}.sqlite"

# Step 1: Check app status
print_status "Checking app status..."
if ! $FLY_CMD status --app $APP_NAME &> /dev/null; then
    print_error "Cannot access app. Make sure you're logged in and have access."
    exit 1
fi

# Step 2: Create backup
print_status "Creating database backup..."
echo "This may take a moment depending on database size..."

# Method 1: Try using fly ssh console with direct output
if $FLY_CMD ssh console --app $APP_NAME -C "cat /data/database.sqlite" > "$BACKUP_FILE" 2>/dev/null; then
    print_success "Backup created successfully"
else
    print_warning "Direct backup failed, trying alternative method..."
    
    # Method 2: Use fly sftp if available
    if command -v scp &> /dev/null; then
        print_status "Attempting SCP backup..."
        # Create a temporary script on the server
        $FLY_CMD ssh console --app $APP_NAME -C "cp /data/database.sqlite /tmp/backup.sqlite"
        
        # Use fly proxy to establish connection
        $FLY_CMD proxy 10022:22 --app $APP_NAME &
        PROXY_PID=$!
        sleep 3
        
        # Try to copy the file
        scp -P 10022 root@localhost:/tmp/backup.sqlite "$BACKUP_FILE" 2>/dev/null || true
        
        # Kill the proxy
        kill $PROXY_PID 2>/dev/null || true
        
        # Clean up temp file
        $FLY_CMD ssh console --app $APP_NAME -C "rm -f /tmp/backup.sqlite" 2>/dev/null || true
    fi
fi

# Step 3: Verify backup
if [ -f "$BACKUP_FILE" ]; then
    FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
    
    if [ -s "$BACKUP_FILE" ]; then
        print_success "Backup completed: $BACKUP_FILE"
        print_status "Backup size: $FILE_SIZE"
        
        # Test backup integrity
        if command -v sqlite3 &> /dev/null; then
            print_status "Verifying backup integrity..."
            if sqlite3 "$BACKUP_FILE" "PRAGMA integrity_check;" &> /dev/null; then
                print_success "Backup integrity verified"
            else
                print_warning "Could not verify backup integrity"
            fi
        else
            print_warning "SQLite not installed locally, skipping integrity check"
        fi
    else
        print_error "Backup file is empty!"
        rm "$BACKUP_FILE"
        exit 1
    fi
else
    print_error "Backup failed!"
    exit 1
fi

# Step 4: Manage old backups
print_status "Managing backup history..."
BACKUP_COUNT=$(ls -1 $BACKUP_DIR/database_*.sqlite 2>/dev/null | wc -l)
MAX_BACKUPS=10

if [ $BACKUP_COUNT -gt $MAX_BACKUPS ]; then
    print_warning "Found $BACKUP_COUNT backups, keeping only last $MAX_BACKUPS"
    ls -1t $BACKUP_DIR/database_*.sqlite | tail -n +$((MAX_BACKUPS + 1)) | xargs rm
    print_success "Old backups cleaned up"
fi

# Step 5: Show backup info
echo ""
echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}       Backup Complete! 🎉${NC}"
echo -e "${GREEN}=========================================${NC}"
echo ""
echo "Backup saved to: $BACKUP_FILE"
echo ""
echo "Recent backups:"
ls -lht $BACKUP_DIR/database_*.sqlite 2>/dev/null | head -5 || echo "No backups found"
echo ""
echo "To restore this backup:"
echo "  $FLY_CMD ssh console --app $APP_NAME"
echo "  # Then inside the container:"
echo "  # cat > /data/database.sqlite < [paste backup content]"
echo ""
echo "Or use the restore script:"
echo "  ./restore.sh $BACKUP_FILE"