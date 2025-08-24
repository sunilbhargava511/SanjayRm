import { db } from './database';
import * as schema from './database/schema';
import { eq, and, asc, inArray } from 'drizzle-orm';
import { Calculator, NewCalculator } from './database/schema';

export class CalculatorService {
  
  // Calculator Management
  async createCalculator(calculatorData: {
    name: string;
    url: string;
    description: string;
    orderIndex?: number;
  }): Promise<Calculator> {
    const calculatorId = `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Get the highest order index if not provided
    let orderIndex = calculatorData.orderIndex;
    if (orderIndex === undefined) {
      const existingCalculators = await this.getAllCalculators();
      orderIndex = existingCalculators.length;
    }
    
    const newCalculator = await db.insert(schema.calculators).values({
      id: calculatorId,
      name: calculatorData.name,
      url: calculatorData.url,
      description: calculatorData.description,
      orderIndex,
      active: true,
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
    let query = db
      .select()
      .from(schema.calculators)
      .orderBy(asc(schema.calculators.orderIndex));

    if (activeOnly) {
      query = query.where(eq(schema.calculators.active, true));
    }

    const calculators = await query;
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