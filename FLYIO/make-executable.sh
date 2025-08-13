#!/bin/bash

# Make all scripts executable
chmod +x setup.sh
chmod +x deploy.sh
chmod +x secrets.sh
chmod +x backup.sh

echo "✅ All scripts are now executable!"
echo ""
echo "You can now run:"
echo "  ./setup.sh    - Initial Fly.io setup"
echo "  ./deploy.sh   - Deploy updates"
echo "  ./secrets.sh  - Manage API keys"
echo "  ./backup.sh   - Backup database"