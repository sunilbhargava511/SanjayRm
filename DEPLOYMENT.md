# Deployment Guide - Sanjay's Financial Advisor

## 🚀 Quick Deployment to Vercel

### Prerequisites
- GitHub account with repository access
- Claude API key from Anthropic
- Vercel account (free tier is sufficient)

### Step 1: Deploy to Vercel

1. **Visit Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with your GitHub account

2. **Import Project**
   - Click "New Project"
   - Select "Import Git Repository"
   - Choose `sunilbhargava511/SanjayRm`

3. **Configure Build Settings**
   - Framework Preset: Next.js
   - Root Directory: `./` (leave default)
   - Build Command: `npm run build`
   - Output Directory: `.next` (leave default)

### Step 2: Environment Variables

Add these environment variables in Vercel dashboard:

```env
ANTHROPIC_API_KEY=your_claude_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_key_here (optional)
```

**To add environment variables:**
1. Go to your project dashboard in Vercel
2. Navigate to "Settings" → "Environment Variables"
3. Add each variable with its value
4. Select all environments (Production, Preview, Development)

### Step 3: Deploy

1. Click "Deploy" to start the deployment
2. Wait for build to complete (usually 1-2 minutes)
3. Your app will be live at: `your-project-name.vercel.app`

### Step 4: Get Your Claude API Key

1. **Visit Anthropic Console**
   - Go to [console.anthropic.com](https://console.anthropic.com)
   - Sign up/Sign in

2. **Create API Key**
   - Navigate to "API Keys"
   - Click "Create Key"
   - Copy your API key

3. **Add to Vercel**
   - Paste the key as `ANTHROPIC_API_KEY` in Vercel environment variables
   - Redeploy if necessary

## 🛠️ Local Development Setup

### Prerequisites
- Node.js 18+ installed
- Git installed

### Steps

1. **Clone Repository**
   ```bash
   git clone https://github.com/sunilbhargava511/SanjayRm.git
   cd SanjayRm
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your API keys
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Open Application**
   - Visit `http://localhost:3000`

## 🔧 Configuration Options

### Custom Domain (Optional)
1. Go to Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Follow DNS configuration instructions

### Performance Optimization
- The app is already optimized for production
- Static assets are automatically cached
- API routes use efficient caching strategies

## 🚨 Troubleshooting

### Build Errors
- Ensure all environment variables are set
- Check Claude API key validity
- Verify Node.js version (18+)

### Voice Recognition Issues
- Requires HTTPS (Vercel provides this automatically)
- Works best in Chrome/Safari
- Requires microphone permissions

### API Errors
- Verify Claude API key is correct
- Check API quota/billing in Anthropic console
- Review Vercel function logs for detailed errors

## 📊 Monitoring

### Analytics
- Vercel provides basic analytics in the dashboard
- Monitor API usage in Anthropic console
- Track user sessions through application logs

### Performance
- Vercel automatically provides performance metrics
- Monitor Core Web Vitals in the dashboard
- Set up alerts for function timeouts or errors

## 🔒 Security Notes

- API keys are securely stored as environment variables
- No financial data is transmitted to servers
- All user sessions stored locally in browser
- Voice data processed client-side only

---

**Need Help?**
- Check Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
- Anthropic API docs: [docs.anthropic.com](https://docs.anthropic.com)
- Repository issues: [GitHub Issues](https://github.com/sunilbhargava511/SanjayRm/issues)