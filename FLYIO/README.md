# 🚀 Fly.io Deployment Guide for Financial Advisor App

## 📍 Mumbai Region Deployment for India Users

This guide will help you deploy your Financial Advisor app to Fly.io's Mumbai region for optimal performance with Indian users.

## Prerequisites

### 1. Install Fly.io CLI

**macOS:**
```bash
brew install flyctl
```

**Windows:**
```bash
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

**Linux:**
```bash
curl -L https://fly.io/install.sh | sh
```

### 2. Create Fly.io Account
```bash
fly auth signup
# OR if you have an account:
fly auth login
```

## 🚀 Quick Start (5 Minutes)

If you want to deploy immediately, run:

```bash
cd FLYIO
chmod +x setup.sh
./setup.sh
```

This will handle everything automatically. Otherwise, follow the manual steps below.

## 📝 Manual Setup Steps

### Step 1: Initialize Your App

```bash
# From your project root (not FLYIO directory)
fly launch --no-deploy
```

When prompted:
- **App name**: `your-financial-advisor` (or your choice)
- **Region**: Select `bom (Mumbai, India)`
- **PostgreSQL**: Select "No" (we're using SQLite)
- **Redis**: Select "No"

### Step 2: Configure fly.toml

Copy the provided `fly.toml` from this directory to your project root:

```bash
cp FLYIO/fly.toml ./fly.toml
```

Edit the app name in fly.toml:
```toml
app = "your-financial-advisor"  # Change to your app name
```

### Step 3: Create Persistent Volume for SQLite

```bash
# Create 1GB volume in Mumbai for your database
fly volumes create sqlite_data --region bom --size 1
```

### Step 4: Set Environment Variables

Run the secrets script or set manually:

```bash
# Option 1: Use our script
cd FLYIO
chmod +x secrets.sh
./secrets.sh

# Option 2: Set manually
fly secrets set ANTHROPIC_API_KEY="your-anthropic-key"
fly secrets set ELEVENLABS_API_KEY="your-elevenlabs-key"
fly secrets set NEXT_PUBLIC_ELEVENLABS_API_KEY="your-elevenlabs-key"
fly secrets set ELEVENLABS_AGENT_ID="your-agent-id"
fly secrets set ELEVENLABS_WEBHOOK_SECRET="your-webhook-secret"
```

### Step 5: Deploy Your App

```bash
# First deployment
fly deploy

# After deployment, check status
fly status

# View logs
fly logs
```

### Step 6: Configure Custom Domain (Optional)

```bash
# Add your domain
fly certs add yourdomain.com

# Follow the DNS instructions provided
```

## 🗄️ Database Management

### Accessing Your SQLite Database

```bash
# SSH into your app
fly ssh console

# Inside the container
cd /data
sqlite3 database.sqlite
```

### Backup Your Database

```bash
# Run the backup script
cd FLYIO
chmod +x backup.sh
./backup.sh
```

### Restore from Backup

```bash
# Copy backup to the server
fly ssh console -C "cat > /data/database.sqlite" < backup_20240312_120000.sqlite
```

## 🔧 Troubleshooting

### Issue: Database not persisting

**Solution**: Ensure your volume is mounted correctly in fly.toml:
```toml
[mounts]
  source = "sqlite_data"
  destination = "/data"
```

### Issue: High latency from India

**Solution**: Verify your app is in Mumbai:
```bash
fly regions list
# Should show: Region Pool: bom
```

### Issue: Environment variables not working

**Solution**: Check secrets are set:
```bash
fly secrets list
```

### Issue: Build failures

**Solution**: Check Dockerfile and ensure all dependencies are installed:
```bash
fly logs
# Look for build errors
```

## 📊 Monitoring

### View Real-time Logs
```bash
fly logs --tail
```

### Check App Status
```bash
fly status
```

### Monitor Resources
```bash
fly dashboard
# Opens monitoring in browser
```

### Scale Your App
```bash
# Add more instances
fly scale count 2

# Increase resources
fly scale vm shared-cpu-2x
```

## 🔄 Deployment Workflow

### For Updates
```bash
# 1. Make your code changes
# 2. Test locally
npm run dev

# 3. Deploy to Fly.io
fly deploy

# 4. Monitor deployment
fly logs --tail
```

### Quick Deploy Script
```bash
cd FLYIO
./deploy.sh
```

## 🌍 Region Performance

From Mumbai (bom) region, expect:
- **India users**: 10-30ms latency ✅
- **Southeast Asia**: 40-80ms latency ✅
- **Middle East**: 60-100ms latency ✅
- **Europe**: 120-150ms latency ⚠️
- **US**: 200-250ms latency ⚠️

## 💰 Cost Estimation

**Fly.io Pricing for your app:**
- **Hobby Plan**: Free (included resources)
  - 3 shared-cpu-1x VMs
  - 3GB persistent volume storage
  - 160GB outbound transfer

**Estimated Monthly Cost**: $0-5
- VM: Free (within limits)
- Volume (1GB): Free
- Bandwidth: Free (under 160GB)

**Only pay if you exceed:**
- Additional storage: $0.15/GB/month
- Extra bandwidth: $0.02/GB
- More VMs: $2-5/month each

## 🚨 Important Notes

1. **Database Path**: Your app uses `/data/database.sqlite` in production
2. **Cold Starts**: First request after idle may take 1-2 seconds
3. **Backups**: Run weekly backups using the provided script
4. **Scaling**: Start with 1 instance, scale as needed
5. **Mumbai Region**: Critical for India performance

## 📞 Support Resources

- **Fly.io Documentation**: https://fly.io/docs
- **Community Forum**: https://community.fly.io
- **Status Page**: https://status.flyio.net
- **Our App Issues**: Check FLYIO/troubleshooting.md

## ✅ Deployment Checklist

- [ ] Fly CLI installed
- [ ] Logged into Fly.io account
- [ ] App created in Mumbai region
- [ ] SQLite volume created
- [ ] Environment variables set
- [ ] fly.toml configured
- [ ] First deployment successful
- [ ] Database backup configured
- [ ] Custom domain (optional)
- [ ] Monitoring setup

## 🎉 Success Indicators

Your app is successfully deployed when:
1. `fly status` shows "running" state
2. App accessible at `https://your-app.fly.dev`
3. Database persists between deployments
4. Voice interactions have <50ms latency from India
5. Logs show successful API connections

---

**Need help?** Check the troubleshooting section or run `fly doctor` for diagnostics.