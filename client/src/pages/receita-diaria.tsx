import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface DailyData {
  date: string;
  day: number;
  totalValue: number;
}

interface YearSeries {
  year: number;
  daily: DailyData[];
  total: number;
}

interface DailyRevenueResponse {
  period: {
    month: number;
    monthName: string;
    year: number;
    compareYears: number[];
  };
  storeId: string;
  series: YearSeries[];
}

const monthNames = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const storeNames: Record<string, string> = {
  'todas': 'Todas as Lojas',
  'saron1': 'Saron 1',
  'saron2': 'Saron 2',
  'saron3': 'Saron 3',
};

const yearColors: Record<number, string> = {
  2025: "#10b981",
  2024: "#3b82f6",
  2023: "#8b5cf6",
  2022: "#f59e0b",
  2021: "#ef4444",
};

export default function ReceitaDiaria() {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedStore, setSelectedStore] = useState("todas");
  const [compareYears, setCompareYears] = useState<number[]>([now.getFullYear() - 1]);

  const availableYears = useMemo(() => {
    const years = [];
    for (let y = now.getFullYear(); y >= 2020; y--) {
      years.push(y);
    }
    return years;
  }, []);

  const compareYearsString = compareYears.join(',');

  const { data, isLoading } = useQuery<DailyRevenueResponse>({
    queryKey: ['/api/financial/daily-revenue', selectedStore, selectedMonth, selectedYear, compareYearsString],
    queryFn: async () => {
      const params = new URLSearchParams({
        storeId: selectedStore,
        month: selectedMonth.toString(),
        year: selectedYear.toString(),
      });
      if (compareYears.length > 0) {
        params.set('compareYears', compareYearsString);
      }
      const res = await fetch(`/api/financial/daily-revenue?${params}`);
      if (!res.ok) throw new Error('Erro ao carregar dados');
      return res.json();
    },
    refetchInterval: 60000,
  });

  const toggleCompareYear = (year: number) => {
    setCompareYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      }
      return [...prev, year].sort((a, b) => b - a);
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const goToPreviousMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const goToNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const chartData = useMemo(() => {
    if (!data?.series) return [];
    
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const result: any[] = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dayData: any = { day };
      
      for (const series of data.series) {
        const dayEntry = series.daily.find(d => d.day === day);
        dayData[`year_${series.year}`] = dayEntry?.totalValue || 0;
      }
      
      result.push(dayData);
    }
    
    return result;
  }, [data, selectedYear, selectedMonth]);

  const tableData = useMemo(() => {
    if (!data?.series) return [];
    
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const result: any[] = [];
    
    for (let day = 1; day <= daysInMonth; day++) {
      const row: any = { day, date: `${String(day).padStart(2, '0')}/${String(selectedMonth).padStart(2, '0')}` };
      
      const currentYearSeries = data.series.find(s => s.year === selectedYear);
      const currentDayData = currentYearSeries?.daily.find(d => d.day === day);
      row.currentValue = currentDayData?.totalValue || 0;
      
      for (const compareYear of compareYears) {
        const compareSeries = data.series.find(s => s.year === compareYear);
        const compareDayData = compareSeries?.daily.find(d => d.day === day);
        row[`compare_${compareYear}`] = compareDayData?.totalValue || 0;
        
        if (row.currentValue > 0 && row[`compare_${compareYear}`] > 0) {
          row[`delta_${compareYear}`] = ((row.currentValue - row[`compare_${compareYear}`]) / row[`compare_${compareYear}`]) * 100;
        } else {
          row[`delta_${compareYear}`] = null;
        }
      }
      
      result.push(row);
    }
    
    return result;
  }, [data, selectedYear, selectedMonth, compareYears]);

  const totals = useMemo(() => {
    if (!data?.series) return { current: 0, compare: {} as Record<number, number> };
    
    const currentTotal = data.series.find(s => s.year === selectedYear)?.total || 0;
    const compareTotal: Record<number, number> = {};
    
    for (const year of compareYears) {
      compareTotal[year] = data.series.find(s => s.year === year)?.total || 0;
    }
    
    return { current: currentTotal, compare: compareTotal };
  }, [data, selectedYear, compareYears]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <BarChart3 className="h-6 w-6" />
            Receita Diária
          </h1>
          <p className="text-muted-foreground">Comparativo de vendas dia a dia</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={goToPreviousMonth}
                data-testid="button-prev-month"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
                <SelectTrigger className="w-[140px]" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((name, index) => (
                    <SelectItem key={index} value={(index + 1).toString()}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-[100px]" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                variant="outline" 
                size="icon"
                onClick={goToNextMonth}
                data-testid="button-next-month"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Loja:</span>
              <Select value={selectedStore} onValueChange={setSelectedStore}>
                <SelectTrigger className="w-[160px]" data-testid="select-store">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Lojas</SelectItem>
                  <SelectItem value="saron1">Saron 1</SelectItem>
                  <SelectItem value="saron2">Saron 2</SelectItem>
                  <SelectItem value="saron3">Saron 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">Comparar com:</span>
              {availableYears
                .filter(y => y !== selectedYear)
                .slice(0, 4)
                .map((year) => (
                  <div key={year} className="flex items-center gap-1">
                    <Checkbox
                      id={`compare-${year}`}
                      checked={compareYears.includes(year)}
                      onCheckedChange={() => toggleCompareYear(year)}
                      data-testid={`checkbox-compare-${year}`}
                    />
                    <label 
                      htmlFor={`compare-${year}`} 
                      className="text-sm cursor-pointer"
                      style={{ color: yearColors[year] || '#888' }}
                    >
                      {year}
                    </label>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total {selectedYear}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-foreground" data-testid="text-total-current">
                {formatCurrency(totals.current)}
              </div>
            )}
          </CardContent>
        </Card>
        
        {compareYears.slice(0, 3).map((year) => {
          const compareValue = totals.compare[year] || 0;
          const delta = totals.current > 0 && compareValue > 0 
            ? ((totals.current - compareValue) / compareValue) * 100 
            : null;
          
          return (
            <Card key={year}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total {year}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-32" />
                ) : (
                  <div className="space-y-1">
                    <div className="text-2xl font-bold text-foreground" data-testid={`text-total-${year}`}>
                      {formatCurrency(compareValue)}
                    </div>
                    {delta !== null && (
                      <div className={`flex items-center gap-1 text-sm ${delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {delta >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        <span>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Gráfico de Receitas - {monthNames[selectedMonth - 1]} {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[350px] w-full" />
          ) : (
            <div className="h-[350px]" data-testid="chart-daily-revenue">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    {data?.series.map((s) => (
                      <linearGradient key={s.year} id={`color${s.year}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={yearColors[s.year] || '#888'} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={yearColors[s.year] || '#888'} stopOpacity={0.1}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="day" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => {
                      const year = name.replace('year_', '');
                      return [formatCurrency(value), year];
                    }}
                    labelFormatter={(label) => `Dia ${label}`}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend 
                    formatter={(value: string) => value.replace('year_', '')}
                  />
                  {data?.series.map((s) => (
                    <Area
                      key={s.year}
                      type="monotone"
                      dataKey={`year_${s.year}`}
                      stroke={yearColors[s.year] || '#888'}
                      fillOpacity={1}
                      fill={`url(#color${s.year})`}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento Diário</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Dia</TableHead>
                    <TableHead className="text-right" style={{ color: yearColors[selectedYear] }}>
                      {selectedYear}
                    </TableHead>
                    {compareYears.map((year) => (
                      <TableHead key={year} className="text-right" style={{ color: yearColors[year] }}>
                        {year}
                      </TableHead>
                    ))}
                    {compareYears.map((year) => (
                      <TableHead key={`delta-${year}`} className="text-right">
                        Δ {year}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableData.map((row) => (
                    <TableRow key={row.day} data-testid={`row-day-${row.day}`}>
                      <TableCell className="font-medium">{row.date}</TableCell>
                      <TableCell className="text-right font-medium">
                        {row.currentValue > 0 ? formatCurrency(row.currentValue) : '-'}
                      </TableCell>
                      {compareYears.map((year) => (
                        <TableCell key={year} className="text-right">
                          {row[`compare_${year}`] > 0 ? formatCurrency(row[`compare_${year}`]) : '-'}
                        </TableCell>
                      ))}
                      {compareYears.map((year) => {
                        const delta = row[`delta_${year}`];
                        return (
                          <TableCell key={`delta-${year}`} className="text-right">
                            {delta !== null ? (
                              <Badge 
                                variant={delta >= 0 ? "default" : "destructive"}
                                className={delta >= 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
                              >
                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                              </Badge>
                            ) : '-'}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(totals.current)}
                    </TableCell>
                    {compareYears.map((year) => (
                      <TableCell key={year} className="text-right">
                        {formatCurrency(totals.compare[year] || 0)}
                      </TableCell>
                    ))}
                    {compareYears.map((year) => {
                      const compareValue = totals.compare[year] || 0;
                      const delta = totals.current > 0 && compareValue > 0 
                        ? ((totals.current - compareValue) / compareValue) * 100 
                        : null;
                      return (
                        <TableCell key={`delta-${year}`} className="text-right">
                          {delta !== null ? (
                            <Badge 
                              variant={delta >= 0 ? "default" : "destructive"}
                              className={delta >= 0 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : ""}
                            >
                              {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
                            </Badge>
                          ) : '-'}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
