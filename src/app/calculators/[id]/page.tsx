import React from 'react';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, AlertTriangle, Clock } from 'lucide-react';
import { db } from '@/lib/database';
import { calculators } from '@/lib/database/schema';
import { eq } from 'drizzle-orm';
import type { Calculator } from '@/lib/database/schema';
import CalculatorClient from './CalculatorClient';

interface CalculatorPageProps {
  params: Promise<{
    id: string;
  }>;
}

async function getCalculator(id: string): Promise<Calculator | null> {
  try {
    const result = await db
      .select()
      .from(calculators)
      .where(eq(calculators.id, id))
      .limit(1);
    
    if (!result || result.length === 0) {
      return null;
    }

    // Transform database result to match Calculator type
    const calculator = {
      ...result[0],
      active: Boolean(result[0].active),
      isPublished: Boolean(result[0].isPublished),
      createdAt: result[0].createdAt,
      updatedAt: result[0].updatedAt
    };

    return calculator;
  } catch (error) {
    console.error('Error fetching calculator:', error);
    return null;
  }
}

export default async function CalculatorPage({ params }: CalculatorPageProps) {
  const resolvedParams = await params;
  const calculator = await getCalculator(resolvedParams.id);

  if (!calculator) {
    notFound();
  }

  // Check if calculator is published
  if (!calculator.isPublished) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-4">
          <Clock className="h-12 w-12 text-orange-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Calculator Not Available
          </h2>
          <p className="text-gray-600 mb-6">
            This calculator is currently unpublished and not available for use.
          </p>
        </div>
      </div>
    );
  }

  return <CalculatorClient calculator={calculator} />;
}