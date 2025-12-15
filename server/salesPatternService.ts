import { db } from './db';
import { sales } from '@shared/schema';
import { sql, and, gte, lte, eq } from 'drizzle-orm';

interface DayWeight {
  day: number;
  weight: number;
  avgSales: number;
  sampleCount: number;
}

interface MonthPattern {
  month: number;
  year?: number;
  days: DayWeight[];
  totalAvgSales: number;
}

interface ExpectedProgressResult {
  expectedPercentage: number;
  linearPercentage: number;
  patternBased: boolean;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

export class SalesPatternService {
  private patternCache: Map<string, { data: MonthPattern; timestamp: number }> = new Map();
  private CACHE_TTL = 60 * 60 * 1000; // 1 hour

  async getMonthPattern(month: number, storeId?: string): Promise<MonthPattern> {
    const cacheKey = `${month}-${storeId || 'all'}`;
    const cached = this.patternCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const pattern = await this.calculateMonthPattern(month, storeId);
    this.patternCache.set(cacheKey, { data: pattern, timestamp: Date.now() });
    return pattern;
  }

  private async calculateMonthPattern(month: number, storeId?: string): Promise<MonthPattern> {
    const currentYear = new Date().getFullYear();
    const yearsToAnalyze = [currentYear - 1, currentYear - 2]; // Analyze last 2 years
    
    const dayData: Map<number, { total: number; count: number }> = new Map();
    
    for (let day = 1; day <= 31; day++) {
      dayData.set(day, { total: 0, count: 0 });
    }

    for (const year of yearsToAnalyze) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      try {
        let query;
        if (storeId && storeId !== 'todas') {
          query = sql`
            SELECT 
              EXTRACT(DAY FROM sale_date) as day,
              SUM(total_value) as total_sales
            FROM sales
            WHERE sale_date >= ${startDate}
              AND sale_date <= ${endDate}
              AND store_id = ${storeId}
            GROUP BY EXTRACT(DAY FROM sale_date)
          `;
        } else {
          query = sql`
            SELECT 
              EXTRACT(DAY FROM sale_date) as day,
              SUM(total_value) as total_sales
            FROM sales
            WHERE sale_date >= ${startDate}
              AND sale_date <= ${endDate}
            GROUP BY EXTRACT(DAY FROM sale_date)
          `;
        }
        
        const result = await db.execute(query);
        const rows = result.rows as Array<{ day: string; total_sales: string }>;
        
        for (const row of rows) {
          const day = parseInt(row.day);
          const sales = parseFloat(row.total_sales) || 0;
          const existing = dayData.get(day) || { total: 0, count: 0 };
          dayData.set(day, {
            total: existing.total + sales,
            count: existing.count + 1,
          });
        }
      } catch (error) {
        console.error(`[SalesPattern] Error fetching data for ${year}-${month}:`, error);
      }
    }

    const days: DayWeight[] = [];
    let totalAvgSales = 0;
    
    for (let day = 1; day <= 31; day++) {
      const data = dayData.get(day) || { total: 0, count: 0 };
      const avgSales = data.count > 0 ? data.total / data.count : 0;
      totalAvgSales += avgSales;
      days.push({
        day,
        weight: 0, // Will be calculated after
        avgSales,
        sampleCount: data.count,
      });
    }

    // Calculate weights (each day's percentage of total monthly sales)
    if (totalAvgSales > 0) {
      for (const dayWeight of days) {
        dayWeight.weight = dayWeight.avgSales / totalAvgSales;
      }
    } else {
      // Fallback to equal weights if no data
      const daysInMonth = new Date(currentYear, month, 0).getDate();
      for (const dayWeight of days) {
        if (dayWeight.day <= daysInMonth) {
          dayWeight.weight = 1 / daysInMonth;
        }
      }
    }

    return {
      month,
      days,
      totalAvgSales,
    };
  }

  async calculateExpectedProgress(
    startDate: Date,
    endDate: Date,
    currentDate: Date,
    storeId?: string
  ): Promise<ExpectedProgressResult> {
    const startMonth = startDate.getMonth() + 1;
    const endMonth = endDate.getMonth() + 1;
    
    // For simplicity, handle same-month periods
    // For cross-month periods, we'd need to combine patterns
    if (startMonth !== endMonth) {
      // Use linear calculation for cross-month periods for now
      const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const elapsedDays = Math.max(0, Math.floor((currentDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const linearPercentage = Math.min(100, (elapsedDays / totalDays) * 100);
      
      return {
        expectedPercentage: linearPercentage,
        linearPercentage,
        patternBased: false,
        confidence: 'low',
        explanation: 'Período cruza meses - usando cálculo linear',
      };
    }

    try {
      const pattern = await this.getMonthPattern(startMonth, storeId);
      
      const startDay = startDate.getDate();
      const endDay = endDate.getDate();
      const currentDay = Math.min(currentDate.getDate(), endDay);
      
      // Calculate total weight for the period
      let totalPeriodWeight = 0;
      let elapsedWeight = 0;
      
      for (let day = startDay; day <= endDay; day++) {
        const dayWeight = pattern.days.find(d => d.day === day);
        if (dayWeight) {
          totalPeriodWeight += dayWeight.weight;
          if (day <= currentDay) {
            elapsedWeight += dayWeight.weight;
          }
        }
      }
      
      // Calculate expected percentage based on weighted progress
      let expectedPercentage = 0;
      if (totalPeriodWeight > 0) {
        expectedPercentage = (elapsedWeight / totalPeriodWeight) * 100;
      }
      
      // Calculate linear percentage for comparison
      const totalDays = endDay - startDay + 1;
      const elapsedDays = Math.max(0, currentDay - startDay + 1);
      const linearPercentage = (elapsedDays / totalDays) * 100;
      
      // Determine confidence based on sample data
      const avgSampleCount = pattern.days
        .filter(d => d.day >= startDay && d.day <= endDay)
        .reduce((sum, d) => sum + d.sampleCount, 0) / totalDays;
      
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (avgSampleCount >= 2) confidence = 'high';
      else if (avgSampleCount >= 1) confidence = 'medium';
      
      // Generate explanation
      let explanation = '';
      const diff = expectedPercentage - linearPercentage;
      if (Math.abs(diff) < 2) {
        explanation = 'Padrão similar ao linear';
      } else if (diff > 0) {
        explanation = `Período mais forte (+${diff.toFixed(0)}% do linear)`;
      } else {
        explanation = `Período mais fraco (${diff.toFixed(0)}% do linear)`;
      }
      
      return {
        expectedPercentage: Math.round(expectedPercentage * 100) / 100,
        linearPercentage: Math.round(linearPercentage * 100) / 100,
        patternBased: true,
        confidence,
        explanation,
      };
    } catch (error) {
      console.error('[SalesPattern] Error calculating expected progress:', error);
      
      // Fallback to linear
      const totalDays = Math.max(1, Math.floor((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const elapsedDays = Math.max(0, Math.floor((currentDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)) + 1);
      const linearPercentage = Math.min(100, (elapsedDays / totalDays) * 100);
      
      return {
        expectedPercentage: linearPercentage,
        linearPercentage,
        patternBased: false,
        confidence: 'low',
        explanation: 'Erro ao calcular padrão - usando linear',
      };
    }
  }

  async getWeeklyPattern(storeId?: string): Promise<{ dayOfWeek: number; weight: number }[]> {
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear - 1}-01-01`;
    const endDate = `${currentYear}-12-31`;
    
    try {
      let query;
      if (storeId && storeId !== 'todas') {
        query = sql`
          SELECT 
            EXTRACT(DOW FROM sale_date) as day_of_week,
            SUM(total_value) as total_sales,
            COUNT(DISTINCT sale_date) as days_count
          FROM sales
          WHERE sale_date >= ${startDate}
            AND sale_date <= ${endDate}
            AND store_id = ${storeId}
          GROUP BY EXTRACT(DOW FROM sale_date)
        `;
      } else {
        query = sql`
          SELECT 
            EXTRACT(DOW FROM sale_date) as day_of_week,
            SUM(total_value) as total_sales,
            COUNT(DISTINCT sale_date) as days_count
          FROM sales
          WHERE sale_date >= ${startDate}
            AND sale_date <= ${endDate}
          GROUP BY EXTRACT(DOW FROM sale_date)
        `;
      }
      
      const result = await db.execute(query);
      const rows = result.rows as Array<{ day_of_week: string; total_sales: string; days_count: string }>;
      
      const weekData: { [key: number]: { total: number; count: number } } = {};
      let totalSales = 0;
      
      for (const row of rows) {
        const dow = parseInt(row.day_of_week);
        const sales = parseFloat(row.total_sales) || 0;
        weekData[dow] = { total: sales, count: parseInt(row.days_count) };
        totalSales += sales;
      }
      
      const weeklyPattern = [];
      for (let dow = 0; dow <= 6; dow++) {
        const data = weekData[dow] || { total: 0, count: 0 };
        weeklyPattern.push({
          dayOfWeek: dow,
          weight: totalSales > 0 ? data.total / totalSales : 1/7,
        });
      }
      
      return weeklyPattern;
    } catch (error) {
      console.error('[SalesPattern] Error calculating weekly pattern:', error);
      return [0, 1, 2, 3, 4, 5, 6].map(dow => ({ dayOfWeek: dow, weight: 1/7 }));
    }
  }

  clearCache(): void {
    this.patternCache.clear();
  }
}

export const salesPatternService = new SalesPatternService();
