import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Mock stock data - in production, integrate with real APIs like Alpha Vantage, Yahoo Finance, etc.
const MOCK_STOCK_DATA = {
  'AAPL': {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 193.89,
    change: '+2.34',
    changePercent: '+1.22%',
    marketCap: '3.01T',
    peRatio: 29.8,
    dividendYield: '0.43%',
    volume: '52.3M',
    fiftyTwoWeekHigh: 199.62,
    fiftyTwoWeekLow: 164.08,
    fundamentals: {
      revenue: '383.29B',
      netIncome: '99.80B',
      eps: 6.43,
      bookValue: 4.26,
      debtToEquity: 1.73,
      roe: '147.25%',
      currentRatio: 1.04
    },
    analysis: 'Strong fundamentals with consistent revenue growth. Premium valuation but justified by market position and brand strength. Recommended for long-term growth portfolios.'
  },
  'MSFT': {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    price: 416.42,
    change: '+4.67',
    changePercent: '+1.13%',
    marketCap: '3.09T',
    peRatio: 34.2,
    dividendYield: '0.72%',
    volume: '18.9M',
    fiftyTwoWeekHigh: 468.35,
    fiftyTwoWeekLow: 362.90,
    fundamentals: {
      revenue: '211.91B',
      netIncome: '72.36B',
      eps: 9.65,
      bookValue: 25.87,
      debtToEquity: 0.31,
      roe: '38.52%',
      currentRatio: 1.27
    },
    analysis: 'Excellent cloud growth with Azure. Strong balance sheet and consistent dividend payments. Good choice for both growth and income investors.'
  },
  'GOOGL': {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    price: 171.18,
    change: '+1.87',
    changePercent: '+1.10%',
    marketCap: '2.11T',
    peRatio: 24.5,
    dividendYield: '0.00%',
    volume: '25.6M',
    fiftyTwoWeekHigh: 191.75,
    fiftyTwoWeekLow: 129.40,
    fundamentals: {
      revenue: '307.39B',
      netIncome: '73.79B',
      eps: 5.80,
      bookValue: 78.55,
      debtToEquity: 0.11,
      roe: '27.68%',
      currentRatio: 2.28
    },
    analysis: 'Dominant in search and growing AI capabilities. Strong cash position enables innovation investment. Attractive valuation relative to growth prospects.'
  }
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
    
    const { symbol, analysis_type = 'full' } = JSON.parse(body);
    
    if (!symbol) {
      return NextResponse.json(
        { error: 'Stock symbol is required' },
        { status: 400 }
      );
    }
    
    const stockSymbol = symbol.toUpperCase();
    const stockData = MOCK_STOCK_DATA[stockSymbol as keyof typeof MOCK_STOCK_DATA];
    
    if (!stockData) {
      return NextResponse.json(
        { 
          error: `Stock data not available for ${stockSymbol}. Available symbols: ${Object.keys(MOCK_STOCK_DATA).join(', ')}` 
        },
        { status: 404 }
      );
    }
    
    // Format response based on analysis type
    let response;
    if (analysis_type === 'quick') {
      response = {
        symbol: stockData.symbol,
        name: stockData.name,
        price: stockData.price,
        change: stockData.change,
        changePercent: stockData.changePercent,
        summary: `${stockData.name} is trading at $${stockData.price} (${stockData.changePercent}). ${stockData.analysis}`
      };
    } else {
      response = {
        ...stockData,
        timestamp: new Date().toISOString(),
        recommendation: getInvestmentRecommendation(stockData)
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Stock analysis webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze stock',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

function getInvestmentRecommendation(stockData: any): string {
  const peRatio = stockData.peRatio;
  const roe = parseFloat(stockData.fundamentals.roe.replace('%', ''));
  
  if (peRatio < 20 && roe > 15) {
    return 'BUY - Attractive valuation with strong returns';
  } else if (peRatio < 30 && roe > 10) {
    return 'HOLD - Fair valuation, decent fundamentals';
  } else if (peRatio > 35 || roe < 5) {
    return 'CAUTION - High valuation or weak returns';
  } else {
    return 'HOLD - Mixed signals, monitor closely';
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Stock Analysis Webhook',
      availableSymbols: Object.keys(MOCK_STOCK_DATA),
      parameters: ['symbol (required)', 'analysis_type (optional: quick/full)']
    },
    { status: 200 }
  );
}