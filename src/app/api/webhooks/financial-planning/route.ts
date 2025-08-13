import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

interface FinancialGoal {
  type: 'retirement' | 'house' | 'education' | 'emergency' | 'vacation' | 'other';
  targetAmount: number;
  timeframe: number; // years
  description?: string;
}

interface PlanningRequest {
  age: number;
  income: number;
  goals: FinancialGoal[];
  timeline?: number;
  currentSavings?: number;
  monthlyContribution?: number;
  riskTolerance?: 'conservative' | 'moderate' | 'aggressive';
}

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

function calculateRetirementNeeds(age: number, income: number, retirementAge: number = 65) {
  const yearsToRetirement = retirementAge - age;
  const replacementRatio = 0.8; // 80% of current income
  const annualRetirementIncome = income * replacementRatio;
  const yearsInRetirement = 25; // Assume 25 years in retirement
  const inflationRate = 0.03;
  const returnRate = 0.07;
  
  // Calculate future value of required annual income
  const futureAnnualIncome = annualRetirementIncome * Math.pow(1 + inflationRate, yearsToRetirement);
  
  // Calculate total retirement needs (present value of annuity)
  const retirementNeeds = futureAnnualIncome * ((1 - Math.pow(1 + returnRate, -yearsInRetirement)) / returnRate);
  
  return {
    yearsToRetirement,
    currentAnnualNeed: annualRetirementIncome,
    futureAnnualNeed: futureAnnualIncome,
    totalRetirementNeeds: retirementNeeds,
    recommendedSavingsRate: 0.15 // 15% of income
  };
}

function calculateGoalFunding(goal: FinancialGoal, currentSavings: number = 0, riskTolerance: string = 'moderate') {
  const returnRates = {
    conservative: 0.04,
    moderate: 0.06,
    aggressive: 0.08
  };
  
  const returnRate = returnRates[riskTolerance as keyof typeof returnRates];
  const years = goal.timeframe;
  const futureValue = goal.targetAmount;
  
  // Calculate present value needed
  const presentValueNeeded = futureValue / Math.pow(1 + returnRate, years);
  
  // Calculate monthly contribution needed
  const monthlyRate = returnRate / 12;
  const totalMonths = years * 12;
  
  // Future value of current savings
  const futureValueOfCurrentSavings = currentSavings * Math.pow(1 + returnRate, years);
  
  // Remaining amount needed
  const remainingNeeded = Math.max(0, futureValue - futureValueOfCurrentSavings);
  
  // Monthly contribution to reach remaining goal
  const monthlyContribution = remainingNeeded > 0 
    ? (remainingNeeded * monthlyRate) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
    : 0;
  
  return {
    goal,
    presentValueNeeded: Math.round(presentValueNeeded),
    futureValueOfCurrentSavings: Math.round(futureValueOfCurrentSavings),
    remainingNeeded: Math.round(remainingNeeded),
    monthlyContributionNeeded: Math.round(monthlyContribution),
    onTrack: currentSavings >= presentValueNeeded,
    probability: calculateSuccessProbability(currentSavings, monthlyContribution, goal, returnRate)
  };
}

function calculateSuccessProbability(currentSavings: number, monthlyContribution: number, goal: FinancialGoal, returnRate: number): string {
  // Simple probability calculation based on funding level
  const monthlyRate = returnRate / 12;
  const totalMonths = goal.timeframe * 12;
  
  const futureValueProjected = currentSavings * Math.pow(1 + returnRate, goal.timeframe) + 
    (monthlyContribution * (Math.pow(1 + monthlyRate, totalMonths) - 1)) / monthlyRate;
  
  const fundingRatio = futureValueProjected / goal.targetAmount;
  
  if (fundingRatio >= 1.0) return 'High (90%+)';
  if (fundingRatio >= 0.8) return 'Good (70-80%)';
  if (fundingRatio >= 0.6) return 'Moderate (50-70%)';
  return 'Low (<50%)';
}

function generateRecommendations(planningData: PlanningRequest, calculations: any): string[] {
  const recommendations = [];
  const monthlyIncome = planningData.income / 12;
  
  // Emergency fund recommendation
  const emergencyGoal = planningData.goals.find(g => g.type === 'emergency');
  if (!emergencyGoal) {
    recommendations.push('Build an emergency fund of 3-6 months expenses before focusing on other goals.');
  }
  
  // Savings rate analysis
  const totalMonthlyContributions = calculations.reduce((sum: number, calc: any) => 
    sum + calc.monthlyContributionNeeded, 0);
  const savingsRate = totalMonthlyContributions / monthlyIncome;
  
  if (savingsRate > 0.5) {
    recommendations.push('Your goals require saving over 50% of income. Consider extending timeframes or adjusting target amounts.');
  } else if (savingsRate > 0.3) {
    recommendations.push('Aggressive savings plan needed. Look for ways to increase income or reduce expenses.');
  } else if (savingsRate < 0.1) {
    recommendations.push('You have room to save more. Consider increasing contributions to reach goals faster.');
  }
  
  // Risk tolerance recommendations
  if (planningData.riskTolerance === 'conservative' && planningData.age < 40) {
    recommendations.push('Consider a more aggressive investment approach given your young age and long time horizon.');
  } else if (planningData.riskTolerance === 'aggressive' && planningData.age > 55) {
    recommendations.push('Consider reducing risk as you approach retirement to protect accumulated wealth.');
  }
  
  // Goal prioritization
  const retirementGoal = planningData.goals.find(g => g.type === 'retirement');
  const otherGoals = planningData.goals.filter(g => g.type !== 'retirement' && g.type !== 'emergency');
  
  if (retirementGoal && otherGoals.length > 2) {
    recommendations.push('Focus on retirement and 1-2 other key goals to avoid spreading resources too thin.');
  }
  
  return recommendations;
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
    
    const planningRequest: PlanningRequest = JSON.parse(body);
    
    // Validate required fields
    if (!planningRequest.age || !planningRequest.income || !planningRequest.goals) {
      return NextResponse.json(
        { error: 'Age, income, and goals are required' },
        { status: 400 }
      );
    }
    
    if (!Array.isArray(planningRequest.goals) || planningRequest.goals.length === 0) {
      return NextResponse.json(
        { error: 'At least one financial goal is required' },
        { status: 400 }
      );
    }
    
    // Set defaults
    const currentSavings = planningRequest.currentSavings || 0;
    const riskTolerance = planningRequest.riskTolerance || 'moderate';
    
    // Calculate retirement needs if retirement goal exists
    let retirementAnalysis = null;
    const retirementGoal = planningRequest.goals.find(g => g.type === 'retirement');
    if (retirementGoal) {
      retirementAnalysis = calculateRetirementNeeds(planningRequest.age, planningRequest.income);
    }
    
    // Calculate funding for each goal
    const goalCalculations = planningRequest.goals.map(goal => 
      calculateGoalFunding(goal, currentSavings / planningRequest.goals.length, riskTolerance)
    );
    
    // Generate recommendations
    const recommendations = generateRecommendations(planningRequest, goalCalculations);
    
    // Calculate summary metrics
    const totalMonthlyNeeded = goalCalculations.reduce((sum, calc) => sum + calc.monthlyContributionNeeded, 0);
    const totalTargetAmount = planningRequest.goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
    const savingsRate = (totalMonthlyNeeded * 12) / planningRequest.income;
    
    const response = {
      summary: {
        totalGoals: planningRequest.goals.length,
        totalTargetAmount,
        totalMonthlyContributionNeeded: Math.round(totalMonthlyNeeded),
        requiredSavingsRate: Math.round(savingsRate * 10000) / 100, // percentage
        averageTimeframe: Math.round(planningRequest.goals.reduce((sum, g) => sum + g.timeframe, 0) / planningRequest.goals.length),
        feasibilityRating: savingsRate < 0.2 ? 'Achievable' : savingsRate < 0.35 ? 'Challenging' : 'Very Challenging'
      },
      retirementAnalysis,
      goalCalculations,
      recommendations,
      nextSteps: [
        'Review and prioritize your financial goals',
        'Set up automatic contributions to goal-specific accounts',
        'Consider tax-advantaged accounts (401k, IRA, HSA)',
        'Review and adjust plan annually or when income changes'
      ],
      timestamp: new Date().toISOString()
    };
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Financial planning webhook error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to create financial plan',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  const exampleRequest = {
    age: 30,
    income: 75000,
    goals: [
      { type: 'retirement', targetAmount: 1000000, timeframe: 35 },
      { type: 'house', targetAmount: 60000, timeframe: 5 },
      { type: 'emergency', targetAmount: 25000, timeframe: 2 }
    ],
    currentSavings: 10000,
    riskTolerance: 'moderate'
  };
  
  return NextResponse.json(
    { 
      message: 'Financial Planning Webhook',
      parameters: [
        'age (required)',
        'income (required)', 
        'goals (required array)',
        'currentSavings (optional)',
        'riskTolerance (optional: conservative/moderate/aggressive)'
      ],
      goalTypes: ['retirement', 'house', 'education', 'emergency', 'vacation', 'other'],
      exampleRequest
    },
    { status: 200 }
  );
}