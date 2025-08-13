# 📋 Fly.io Deployment Checklist

## Pre-Deployment Requirements

### ✅ Prerequisites
- [ ] Fly.io CLI installed (`brew install flyctl`)
- [ ] Fly.io account created
- [ ] Git repository committed and pushed

### ✅ API Keys Ready
- [ ] Anthropic API Key (`ANTHROPIC_API_KEY`)
- [ ] ElevenLabs API Key (`ELEVENLABS_API_KEY`)
- [ ] ElevenLabs Public Key (`NEXT_PUBLIC_ELEVENLABS_API_KEY`)
- [ ] ElevenLabs Agent ID (`ELEVENLABS_AGENT_ID`)
- [ ] ElevenLabs Webhook Secret (optional)

## Initial Deployment Steps

### 1️⃣ Setup (First Time Only)
```bash
cd FLYIO
./setup.sh
```
This will:
- Create app in Mumbai region
- Set up SQLite volume
- Configure environment variables
- Deploy your app

### 2️⃣ Verify Deployment
- [ ] Check app status: `fly status --app your-app-name`
- [ ] Visit app URL: `https://your-app-name.fly.dev`
- [ ] Test health endpoint: `https://your-app-name.fly.dev/api/health`
- [ ] Check logs: `fly logs --app your-app-name`

### 3️⃣ Test Core Features
- [ ] Homepage loads correctly
- [ ] Start Conversation button works
- [ ] Educational session creates successfully
- [ ] Voice interface connects
- [ ] Database persists between sessions

## Ongoing Deployment

### 🔄 For Updates
```bash
cd FLYIO
./deploy.sh
```

### 🗄️ For Backups
```bash
cd FLYIO
./backup.sh
```

### 🔐 Update Secrets
```bash
cd FLYIO
./secrets.sh
```

## Performance Verification

### From India (Expected Latency)
- [ ] API Response: <50ms
- [ ] Page Load: <1s
- [ ] Voice Interaction: <100ms round-trip

### Test Commands
```bash
# Check regions
fly regions list --app your-app-name

# Monitor performance
fly dashboard --app your-app-name

# Scale if needed
fly scale vm shared-cpu-2x --app your-app-name
```

## Troubleshooting Checklist

### If Deployment Fails
- [ ] Check logs: `fly logs --app your-app-name`
- [ ] Verify secrets: `fly secrets list --app your-app-name`
- [ ] Check build locally: `npm run build`
- [ ] Verify Dockerfile: `docker build -t test .`

### If Database Issues
- [ ] Check volume: `fly volumes list --app your-app-name`
- [ ] SSH to container: `fly ssh console --app your-app-name`
- [ ] Check database path: `ls -la /data/`
- [ ] Verify DATABASE_PATH env var is set

### If High Latency
- [ ] Verify Mumbai region: `fly regions list --app your-app-name`
- [ ] Check instance location: `fly status --app your-app-name`
- [ ] Consider scaling: `fly scale count 2 --app your-app-name`

## Post-Deployment

### 📊 Monitoring
- [ ] Set up alerts for downtime
- [ ] Monitor resource usage weekly
- [ ] Review logs for errors daily
- [ ] Check costs monthly

### 🔒 Security
- [ ] Rotate API keys quarterly
- [ ] Review access logs
- [ ] Update dependencies monthly
- [ ] Test backups monthly

### 📈 Optimization
- [ ] Analyze performance metrics
- [ ] Optimize database queries
- [ ] Review cold start times
- [ ] Consider caching strategies

## Success Criteria

Your deployment is successful when:
- ✅ App accessible from India with <50ms latency
- ✅ Voice features work smoothly
- ✅ Database persists data correctly
- ✅ All API integrations functional
- ✅ Health check returns 200 OK
- ✅ No errors in logs for 24 hours

---

**Questions?** Check the README.md or run `fly doctor` for diagnostics.