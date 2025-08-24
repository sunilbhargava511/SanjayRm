import { db } from './database';
import * as schema from './database/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { Calculator, NewCalculator } from './database/schema';

export class CalculatorService {
  
  // Calculator Management
  async createCalculator(calculatorData: {
    name: string;
    url?: string;
    description: string;
    orderIndex?: number;
    calculatorType?: 'url' | 'code';
    codeContent?: string;
    artifactUrl?: string;
    fileName?: string;
    isPublished?: boolean;
  }): Promise<Calculator> {
    const calculatorId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get the highest order index if not provided
    let orderIndex = calculatorData.orderIndex;
    if (orderIndex === undefined) {
      const existingCalculators = await this.getAllCalculators();
      orderIndex = existingCalculators.length;
    }
    
    const calculatorType = calculatorData.calculatorType || 'url';
    
    // Validate required fields based on calculator type
    if (calculatorType === 'url' && !calculatorData.url) {
      throw new Error('URL is required for URL-based calculators');
    }
    if (calculatorType === 'code' && !calculatorData.codeContent) {
      throw new Error('Code content is required for code-based calculators');
    }
    
    const newCalculator = await db.insert(schema.calculators).values({
      id: calculatorId,
      name: calculatorData.name,
      url: calculatorData.url || null,
      description: calculatorData.description,
      calculatorType,
      codeContent: calculatorData.codeContent || null,
      artifactUrl: calculatorData.artifactUrl || null,
      fileName: calculatorData.fileName || null,
      orderIndex,
      active: true,
      isPublished: calculatorData.isPublished ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).returning();

    return this.convertDatabaseCalculator(newCalculator[0]);
  }

  async getCalculator(calculatorId: string): Promise<Calculator | null> {
    const calculators = await db
      .select()
      .from(schema.calculators)
      .where(eq(schema.calculators.id, calculatorId));

    if (calculators.length === 0) {
      return null;
    }

    return this.convertDatabaseCalculator(calculators[0]);
  }

  async getAllCalculators(activeOnly: boolean = false): Promise<Calculator[]> {
    const queryBuilder = db
      .select()
      .from(schema.calculators);

    const calculators = activeOnly 
      ? await queryBuilder
          .where(eq(schema.calculators.active, true))
          .orderBy(asc(schema.calculators.orderIndex))
      : await queryBuilder
          .orderBy(asc(schema.calculators.orderIndex));

    return calculators.map(calc => this.convertDatabaseCalculator(calc));
  }

  async updateCalculator(calculatorId: string, updates: Partial<{
    name: string;
    url: string;
    description: string;
    orderIndex: number;
    active: boolean;
  }>): Promise<void> {
    await db
      .update(schema.calculators)
      .set({
        ...updates,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.calculators.id, calculatorId));
  }

  async deleteCalculator(calculatorId: string): Promise<void> {
    await db
      .delete(schema.calculators)
      .where(eq(schema.calculators.id, calculatorId));
  }

  async reorderCalculators(calculatorIds: string[]): Promise<void> {
    // Update order index for each calculator
    for (let i = 0; i < calculatorIds.length; i++) {
      await db
        .update(schema.calculators)
        .set({
          orderIndex: i,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.calculators.id, calculatorIds[i]));
    }
  }

  // URL validation
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Convert database format to application format
  private convertDatabaseCalculator(dbCalculator: any): Calculator {
    return {
      ...dbCalculator,
      active: Boolean(dbCalculator.active),
      createdAt: dbCalculator.createdAt,
      updatedAt: dbCalculator.updatedAt,
    };
  }
}

// Export singleton instance
export const calculatorService = new CalculatorService();