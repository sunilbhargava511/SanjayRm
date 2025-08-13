import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface PortfolioHolding {
  symbol: string;
  shares: number;
  averageCost: number;
  currentPrice?: number;
}

interface PortfolioData {
  holdings: PortfolioHolding[];
  cashBalance?: number;
  totalValue?: number;
}

// Mock current prices for portfolio calculations
const CURRENT_PRICES: Record<string, number> = {
  'AAPL': 193.89,
  'MSFT': 416.42,
  'GOOGL': 171.18,
  'AMZN': 155.89,
  'TSLA': 248.50,
  'NVDA': 875.30,
  'META': 507.92,
  'NFLX': 697.50,
  'SPY': 512.61,
  'QQQ': 434.18,
  'VTI': 248.75,
  'BRK.B': 429.84
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

function calculatePortfolioMetrics(portfolioData: PortfolioData) {
  const holdings = portfolioData.holdings.map(holding => {
    const currentPrice = CURRENT_PRICES[holding.symbol] || holding.averageCost;
    const currentValue = holding.shares * currentPrice;
    const costBasis = holding.shares * holding.averageCost;
    const gainLoss = currentValue - costBasis;
    const gainLossPercent = ((currentValue - costBasis) / costBasis) * 100;
    
    return {
      ...holding,
      currentPrice,
      currentValue,
      costBasis,
      gainLoss,
      gainLossPercent: Math.round(gainLossPercent * 100) / 100,
      weight: 0 // Will be calculated after total value
    };
  });
  
  const totalInvestmentValue = holdings.reduce((sum, holding) => sum + holding.currentValue, 0);
  const totalCostBasis = holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
  const totalGainLoss = totalInvestmentValue - totalCostBasis;
  const totalGainLossPercent = ((totalGainLoss) / totalCostBasis) * 100;
  const cashBalance = portfolioData.cashBalance || 0;
  const totalPortfolioValue = totalInvestmentValue + cashBalance;
  
  // Calculate weights
  const holdingsWithWeights = holdings.map(holding => ({
    ...holding,
    weight: Math.round((holding.currentValue / totalInvestmentValue) * 10000) / 100
  }));
  
  return {
    holdings: holdingsWithWeights,
    summary: {
      totalPortfolioValue: Math.round(totalPortfolioValue * 100) / 100,
      totalInvestmentValue: Math.round(totalInvestmentValue * 100) / 100,
      cashBalance: Math.round(cashBalance * 100) / 100,
      totalCostBasis: Math.round(totalCostBasis * 100) / 100,
      totalGainLoss: Math.round(totalGainLoss * 100) / 100,
      totalGainLossPercent: Math.round(totalGainLossPercent * 100) / 100,
      numberOfHoldings: holdings.length,
      cashPercentage: Math.round((cashBalance / totalPortfolioValue) * 10000) / 100
    }
  };
}

function analyzePortfolio(metrics: any) {
  const { summary, holdings } = metrics;
  const recommendations = [];
  
  // Diversification analysis
  const topHolding = holdings.reduce((max: any, holding: any) => 
    holding.weight > max.weight ? holding : max
  );
  
  if (topHolding.weight > 30) {
    recommendations.push({
      type: 'diversification',
      priority: 'high',
      message: `Consider reducing ${topHolding.symbol} position (${topHolding.weight}% of portfolio) to improve diversification.`
    });
  }
  
  // Cash allocation analysis
  if (summary.cashPercentage > 20) {
    recommendations.push({
      type: 'asset_allocation',
      priority: 'medium',
      message: `High cash allocation (${summary.cashPercentage}%). Consider investing excess cash for better long-term returns.`
    });
  } else if (summary.cashPercentage < 5) {
    recommendations.push({
      type: 'liquidity',
      priority: 'medium',
      message: `Low cash allocation (${summary.cashPercentage}%). Consider maintaining 5-10% cash for opportunities and emergencies.`
    });
  }
  
  // Performance analysis
  if (summary.totalGainLossPercent < -10) {
    recommendations.push({
      type: 'performance',
      priority: 'high',
      message: `Portfolio is down ${Math.abs(summary.totalGainLossPercent).toFixed(1)}%. Consider reviewing underperforming positions and rebalancing.`
    });
  } else if (summary.totalGainLossPercent > 20) {
    recommendations.push({
      type: 'rebalancing',
      priority: 'medium',
      message: `Strong performance (+${summary.totalGainLossPercent.toFixed(1)}%). Consider taking profits and rebalancing to target allocations.`
    });
  }
  
  // Number of holdings analysis
  if (holdings.length < 5) {
    recommendations.push({
      type: 'diversification',
      priority: 'medium',
      message: `Consider adding more positions (currently ${holdings.length}) to improve diversification across sectors and assets.`
    });
  } else if (holdings.length > 20) {
    recommendations.push({
      type: 'complexity',
      priority: 'low',
      message: `Large number of holdings (${holdings.length}) may be difficult to monitor. Consider consolidating similar positions.`
    });
  }
  
  return {
    overallRating: getOverallRating(summary, recommendations),
    recommendations,
    summary: generatePortfolioSummary(summary, holdings)
  };
}

function getOverallRating(summary: any, recommendations: any[]) {
  const highPriorityIssues = recommendations.filter(r => r.priority === 'high').length;
  const mediumPriorityIssues = recommendations.filter(r => r.priority === 'medium').length;
  
  if (highPriorityIssues > 0) return 'Needs Attention';
  if (mediumPriorityIssues > 2) return 'Good with Improvements';
  if (summary.totalGainLossPercent > 10) return 'Excellent';
  return 'Good';
}

function generatePortfolioSummary(summary: any, holdings: any[]) {
  const topThreeHoldings = holdings
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(h => `${h.symbol} (${h.weight}%)`)
    .join(', ');
    
  return `Portfolio worth $${summary.totalPortfolioValue.toLocaleString()} with ${summary.totalGainLossPercent >= 0 ? 'gains' : 'losses'} of ${Math.abs(summary.totalGainLossPercent).toFixed(1)}%. Top holdings: ${topThreeHoldings}. Cash: ${summary.cashPercentage}%.`;
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
    
    const { portfolio_data } = JSON.parse(body);
    
    if (!portfolio_data || !portfolio_data.holdings || !Array.isArray(portfolio_data.holdings)) {
      return NextResponse.json(
        { error: 'Portfolio data with holdings array is required' },
        { status: 400 }
      );
    }
    
    // Validate holdings format
    for (const holding of portfolio_data.holdings) {
      if (!holding.symbol || typeof holding.shares !== 'number' || typeof holding.averageCost !== 'number') {
        return NextResponse.json(
          { error: 'Each holding must have symbol, shares, and averageCost' },
          { status: 400 }
        );
      }
    }
    
    const metrics = calculatePortfolioMetrics(portfolio_data);
    const analysis = analyzePortfolio(metrics);
    
    const response = {
      portfolio: metrics,
      analysis,
      timestamp: new Date().toISOString(),
      availableActions: [
        'Review individual positions',
        'Rebalance portfolio',
        'Add diversification',
        'Adjust cash allocation'
      ]
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Portfolio review webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze portfolio',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const examplePortfolio = {
    holdings: [
      { symbol: 'AAPL', shares: 50, averageCost: 150 },
      { symbol: 'MSFT', shares: 25, averageCost: 300 },
      { symbol: 'GOOGL', shares: 30, averageCost: 120 }
    ],
    cashBalance: 5000
  };
  
  return NextResponse.json(
    { 
      message: 'Portfolio Review Webhook',
      parameters: ['portfolio_data (required)'],
      exampleRequest: { portfolio_data: examplePortfolio },
      availablePrices: Object.keys(CURRENT_PRICES)
    },
    { status: 200 }
  );
}