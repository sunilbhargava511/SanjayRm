import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Mock market data - in production, integrate with real APIs like Alpha Vantage, Federal Reserve, etc.
const MARKET_DATA = {
  indices: {
    'S&P 500': { value: 5264.85, change: '+0.87%', trend: 'bullish' },
    'NASDAQ': { value: 16432.12, change: '+1.12%', trend: 'bullish' },
    'Dow Jones': { value: 39284.65, change: '+0.54%', trend: 'neutral' },
    'Russell 2000': { value: 2045.32, change: '+0.23%', trend: 'neutral' }
  },
  sectors: {
    technology: { performance: '+12.4%', trend: 'strong', outlook: 'AI and cloud computing driving growth' },
    healthcare: { performance: '+8.7%', trend: 'stable', outlook: 'Aging demographics support long-term growth' },
    financials: { performance: '+15.2%', trend: 'strong', outlook: 'Rising rates benefit banks and insurance' },
    energy: { performance: '-2.3%', trend: 'weak', outlook: 'Oil price volatility and renewable transition' },
    utilities: { performance: '+5.1%', trend: 'stable', outlook: 'Defensive play in uncertain times' },
    'consumer discretionary': { performance: '+9.8%', trend: 'moderate', outlook: 'Consumer spending remains resilient' },
    'consumer staples': { performance: '+3.2%', trend: 'stable', outlook: 'Steady demand but margin pressure' },
    industrials: { performance: '+11.6%', trend: 'strong', outlook: 'Infrastructure spending and manufacturing rebound' },
    materials: { performance: '+6.4%', trend: 'moderate', outlook: 'Supply chain normalization affects pricing' },
    'real estate': { performance: '+2.1%', trend: 'weak', outlook: 'High rates pressure REITs and real estate' },
    communication: { performance: '+7.9%', trend: 'moderate', outlook: 'Mixed results across telecom and media' }
  },
  economic: {
    'Federal Funds Rate': { value: '5.25%', trend: 'stable', impact: 'High rates support savers but pressure growth stocks' },
    'Inflation (CPI)': { value: '3.2%', trend: 'declining', impact: 'Moderating inflation supports market sentiment' },
    'Unemployment': { value: '3.8%', trend: 'stable', impact: 'Low unemployment indicates strong labor market' },
    'GDP Growth': { value: '2.4%', trend: 'stable', impact: 'Moderate growth suggests economic resilience' },
    '10-Year Treasury': { value: '4.35%', trend: 'stable', impact: 'Attractive risk-free returns compete with stocks' }
  },
  sentiment: {
    'VIX (Fear Index)': { value: 18.5, interpretation: 'Moderate volatility expected' },
    'Put/Call Ratio': { value: 0.85, interpretation: 'Slightly optimistic sentiment' },
    'AAII Bull/Bear': { bulls: '42%', bears: '31%', interpretation: 'Cautiously optimistic retail sentiment' }
  },
  trends: [
    {
      title: 'Artificial Intelligence Revolution',
      description: 'AI companies continue to attract massive investment and show strong revenue growth',
      impact: 'Positive for tech sector, potential disruption across industries',
      timeframe: 'Long-term'
    },
    {
      title: 'Interest Rate Peak',
      description: 'Fed may be done raising rates as inflation moderates',
      impact: 'Positive for rate-sensitive sectors like real estate and utilities',
      timeframe: 'Near-term'
    },
    {
      title: 'Geopolitical Tensions',
      description: 'Ongoing conflicts and trade tensions create market uncertainty',
      impact: 'Increased volatility, flight to safe havens',
      timeframe: 'Ongoing'
    },
    {
      title: 'Energy Transition',
      description: 'Shift toward renewable energy accelerating with government support',
      impact: 'Positive for clean energy, negative for traditional fossil fuels',
      timeframe: 'Long-term'
    }
  ]
};

function verifyWebhookSignature(request: NextRequest, body: string): boolean {
  const signature = request.headers.get('elevenlabs-signature');
  const webhookSecret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  
  if (!signature || !webhookSecret) {
    return false;
  }
  
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

function generateMarketSummary(sector?: string, timeframe?: string): string {
  const sp500 = MARKET_DATA.indices['S&P 500'];
  const vix = MARKET_DATA.sentiment['VIX (Fear Index)'];
  
  let summary = `Markets are ${sp500.change.startsWith('+') ? 'up' : 'down'} with the S&P 500 ${sp500.change}. `;
  summary += `Volatility is ${vix.value < 20 ? 'low' : vix.value < 30 ? 'moderate' : 'high'} at ${vix.value}. `;
  
  if (sector && MARKET_DATA.sectors[sector as keyof typeof MARKET_DATA.sectors]) {
    const sectorData = MARKET_DATA.sectors[sector as keyof typeof MARKET_DATA.sectors];
    summary += `The ${sector} sector has performed ${sectorData.performance} and shows ${sectorData.trend} trends. `;
  }
  
  // Add key economic factor
  const inflation = MARKET_DATA.economic['Inflation (CPI)'];
  summary += `Inflation at ${inflation.value} is ${inflation.trend}, which ${inflation.impact.toLowerCase()}.`;
  
  return summary;
}

function getTopInsights(sector?: string, timeframe: string = 'near-term'): any[] {
  let relevantTrends = MARKET_DATA.trends;
  
  if (timeframe === 'near-term') {
    relevantTrends = relevantTrends.filter(trend => 
      trend.timeframe === 'Near-term' || trend.timeframe === 'Ongoing'
    );
  } else if (timeframe === 'long-term') {
    relevantTrends = relevantTrends.filter(trend => 
      trend.timeframe === 'Long-term' || trend.timeframe === 'Ongoing'
    );
  }
  
  // Get top performing and worst performing sectors
  const sectorPerformances = Object.entries(MARKET_DATA.sectors)
    .map(([name, data]) => ({
      name,
      performance: parseFloat(data.performance.replace('%', '')),
      trend: data.trend,
      outlook: data.outlook
    }))
    .sort((a, b) => b.performance - a.performance);
  
  const topSector = sectorPerformances[0];
  const worstSector = sectorPerformances[sectorPerformances.length - 1];
  
  return [
    ...relevantTrends.slice(0, 2),
    {
      title: `${topSector.name} Leading Performance`,
      description: `${topSector.name} sector is up ${topSector.performance}% with ${topSector.trend} trends`,
      impact: topSector.outlook,
      timeframe: 'Current'
    },
    {
      title: `${worstSector.name} Underperforming`,
      description: `${worstSector.name} sector shows ${worstSector.performance}% performance`,
      impact: worstSector.outlook,
      timeframe: 'Current'
    }
  ];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    
    // Verify webhook signature for security
    if (process.env.NODE_ENV === 'production' && !verifyWebhookSignature(request, body)) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }
    
    const { sector, timeframe = 'near-term' } = JSON.parse(body);
    
    // Validate sector if provided
    if (sector && !MARKET_DATA.sectors[sector as keyof typeof MARKET_DATA.sectors]) {
      return NextResponse.json(
        { 
          error: `Unknown sector: ${sector}. Available sectors: ${Object.keys(MARKET_DATA.sectors).join(', ')}` 
        },
        { status: 400 }
      );
    }
    
    // Generate response based on request
    let response;
    
    if (sector) {
      const sectorData = MARKET_DATA.sectors[sector as keyof typeof MARKET_DATA.sectors];
      response = {
        type: 'sector_analysis',
        sector,
        data: sectorData,
        marketContext: {
          indices: MARKET_DATA.indices,
          economic: MARKET_DATA.economic,
          sentiment: MARKET_DATA.sentiment
        },
        summary: generateMarketSummary(sector, timeframe),
        relevantTrends: MARKET_DATA.trends.filter(trend => 
          trend.description.toLowerCase().includes(sector) || 
          trend.title.toLowerCase().includes(sector)
        )
      };
    } else {
      response = {
        type: 'market_overview',
        timeframe,
        marketData: MARKET_DATA,
        summary: generateMarketSummary(undefined, timeframe),
        topInsights: getTopInsights(undefined, timeframe),
        investmentImplications: [
          'Consider diversification across sectors showing strength',
          'Monitor interest rate sensitive sectors for opportunities',
          'Maintain some cash position for market volatility',
          'Focus on quality companies with strong fundamentals'
        ]
      };
    }
    
    response.timestamp = new Date().toISOString();
    response.disclaimer = 'Market data is for educational purposes. Past performance does not guarantee future results.';
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Market insights webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to retrieve market insights',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Market Insights Webhook',
      parameters: [
        'sector (optional): ' + Object.keys(MARKET_DATA.sectors).join(', '),
        'timeframe (optional): near-term, long-term'
      ],
      availableSectors: Object.keys(MARKET_DATA.sectors),
      sampleResponse: {
        summary: generateMarketSummary(),
        dataPoints: Object.keys(MARKET_DATA).length,
        lastUpdated: new Date().toISOString()
      }
    },
    { status: 200 }
  );
}