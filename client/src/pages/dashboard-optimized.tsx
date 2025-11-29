import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ShoppingBag, Package, DollarSign, Calendar, TrendingUp, CalendarDays, Target } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { StoreSelector } from "@/components/store-selector";
import { useDapicClientes, useDapicVendasPDV, useDapicProdutos, useDapicContasPagar } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency } from "@/lib/currency";
import { useUser } from "@/lib/user-context";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function parseBrazilianDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  if (dateStr.includes('-')) {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  }
  
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parseInt(parts[2], 10);
  
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;
  if (year < 1900 || year > 2100) return null;
  
  const date = new Date(year, month - 1, day);
  
  if (date.getDate() !== day || date.getMonth() !== month - 1 || date.getFullYear() !== year) {
    return null;
  }
  
  return date;
}

function isSameDay(date1: Date, date2: Date): boolean {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function isInCurrentWeek(date: Date): boolean {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return date >= weekStart && date <= weekEnd;
}

function isInCurrentMonth(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth();
}

const today = new Date();
const todayStr = format(today, 'yyyy-MM-dd');
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(today.getDate() - 30);
const thirtyDaysAgoStr = format(thirtyDaysAgo, 'yyyy-MM-dd');

const extractSalesList = (salesData: any, isConsolidated: boolean, sellerFilter?: string): any[] => {
  if (!salesData) return [];
  
  let salesList: any[] = [];
  
  if (isConsolidated && salesData.stores) {
    salesList = Object.values(salesData.stores).flatMap((storeData: any) => 
      Array.isArray(storeData?.Dados) ? storeData.Dados : []
    );
  } else if (Array.isArray(salesData?.Dados)) {
    salesList = salesData.Dados;
  }
  
  // Filter by seller name if provided (for vendedor role)
  if (sellerFilter) {
    const normalizedFilter = sellerFilter.toLowerCase().trim();
    salesList = salesList.filter((sale: any) => {
      const sellerName = (sale.NomeVendedor || sale.Vendedor || '').toLowerCase().trim();
      return sellerName === normalizedFilter;
    });
  }
  
  return salesList;
};

const extractClientsList = (clientsData: any, isConsolidated: boolean): any[] => {
  if (!clientsData) return [];
  
  if (isConsolidated && clientsData.stores) {
    return Object.values(clientsData.stores).flatMap((storeData: any) => 
      storeData?.Resultado || storeData?.Dados || []
    );
  }
  
  if (Array.isArray(clientsData?.Resultado)) {
    return clientsData.Resultado;
  }
  
  if (Array.isArray(clientsData?.Dados)) {
    return clientsData.Dados;
  }
  
  return [];
};

const extractProductsList = (productsData: any, isConsolidated: boolean): any[] => {
  if (!productsData) return [];
  
  if (isConsolidated && productsData.stores) {
    return Object.values(productsData.stores).flatMap((storeData: any) => 
      Array.isArray(storeData?.Dados) ? storeData.Dados : []
    );
  }
  
  if (Array.isArray(productsData?.Dados)) {
    return productsData.Dados;
  }
  
  return [];
};

const extractBillsList = (billsData: any, isConsolidated: boolean): any[] => {
  if (!billsData) return [];
  
  if (isConsolidated && billsData.stores) {
    return Object.values(billsData.stores).flatMap((storeData: any) => 
      storeData?.Resultado || storeData?.Dados || []
    );
  }
  
  if (Array.isArray(billsData?.Resultado)) {
    return billsData.Resultado;
  }
  
  if (Array.isArray(billsData?.Dados)) {
    return billsData.Dados;
  }
  
  return [];
};

export default function Dashboard() {
  const { user } = useUser();
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("resumo");
  const [customDateFilter, setCustomDateFilter] = useState(false);
  const [dataInicial, setDataInicial] = useState<string>(thirtyDaysAgoStr);
  const [dataFinal, setDataFinal] = useState<string>(todayStr);
  const [debouncedDataInicial, setDebouncedDataInicial] = useState<string>(thirtyDaysAgoStr);
  const [debouncedDataFinal, setDebouncedDataFinal] = useState<string>(todayStr);
  
  useEffect(() => {
    if (user && !selectedStore) {
      const defaultStore = user.role === "administrador" && !user.storeId ? "todas" : (user.storeId || "saron1");
      setSelectedStore(defaultStore);
    }
  }, [user, selectedStore]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDataInicial(dataInicial);
    }, 500);
    return () => clearTimeout(timer);
  }, [dataInicial]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedDataFinal(dataFinal);
    }, 500);
    return () => clearTimeout(timer);
  }, [dataFinal]);

  const enableSalesData = activeTab === "resumo" || activeTab === "analises";
  const enableClientsData = activeTab === "dados-completos";
  const enableProductsData = activeTab === "dados-completos";
  const enableBillsData = activeTab === "dados-completos";

  const salesQueryParams = useMemo(() => {
    if (customDateFilter) {
      return {
        DataInicial: debouncedDataInicial,
        DataFinal: debouncedDataFinal,
        enabled: enableSalesData,
      };
    }
    
    if (activeTab === "resumo") {
      return {
        DataInicial: thirtyDaysAgoStr,
        DataFinal: todayStr,
        enabled: enableSalesData,
      };
    }
    return {
      DataInicial: '2020-01-01',
      DataFinal: todayStr,
      enabled: enableSalesData,
    };
  }, [activeTab, enableSalesData, customDateFilter, debouncedDataInicial, debouncedDataFinal]);

  const { data: clientsData, isLoading: loadingClients } = useDapicClientes(selectedStore, { enabled: enableClientsData });
  const { data: salesData, isLoading: loadingSales } = useDapicVendasPDV(selectedStore, salesQueryParams);
  const { data: productsData, isLoading: loadingProducts } = useDapicProdutos(selectedStore, { enabled: enableProductsData });
  const { data: billsData, isLoading: loadingBills } = useDapicContasPagar(selectedStore, { enabled: enableBillsData });

  interface DashboardGoal {
    id: string;
    storeId: string;
    type: "individual" | "team";
    period: "weekly" | "monthly";
    sellerId: string | null;
    sellerName: string | null;
    weekStart: string;
    weekEnd: string;
    targetValue: number;
    currentValue: number;
    percentage: number;
    expectedPercentage: number;
    isOnTrack: boolean;
    elapsedDays: number;
    totalDays: number;
  }

  const { data: dashboardGoals = [], isLoading: loadingGoals } = useQuery<DashboardGoal[]>({
    queryKey: ["/api/goals/dashboard", selectedStore],
    queryFn: async () => {
      const res = await fetch(`/api/goals/dashboard?storeId=${selectedStore}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Erro ao buscar metas");
      }
      return res.json();
    },
    enabled: !!selectedStore,
    refetchInterval: 60000,
  });

  const isConsolidated = selectedStore === "todas";

  // For vendedor role, filter sales by their name
  const sellerFilter = user?.role === "vendedor" ? user.fullName : undefined;

  const periodSales = useMemo(() => {
    const salesList = extractSalesList(salesData, isConsolidated, sellerFilter);
    if (salesList.length === 0) return { today: 0, week: 0, month: 0 };

    const now = new Date();
    let today = 0;
    let week = 0;
    let month = 0;

    salesList.forEach((sale: any) => {
      if (sale.DataFechamento) {
        const saleDate = parseBrazilianDate(sale.DataFechamento);
        if (saleDate) {
          const saleValue = typeof sale?.ValorLiquido === 'number' ? sale.ValorLiquido : parseBrazilianCurrency(sale?.ValorLiquido);
          
          if (isSameDay(saleDate, now)) {
            today += saleValue;
          }
          if (isInCurrentWeek(saleDate)) {
            week += saleValue;
          }
          if (isInCurrentMonth(saleDate)) {
            month += saleValue;
          }
        }
      }
    });

    return { today, week, month };
  }, [salesData, isConsolidated, sellerFilter]);

  const chartData = useMemo(() => {
    const salesList = extractSalesList(salesData, isConsolidated, sellerFilter);
    if (salesList.length === 0) return [];

    const monthlyData: Record<string, number> = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    salesList.forEach((sale: any) => {
      if (sale.DataFechamento) {
        const date = parseBrazilianDate(sale.DataFechamento);
        if (date) {
          const monthIndex = date.getMonth();
          const monthKey = monthNames[monthIndex];
          const valor = typeof sale?.ValorLiquido === 'number' ? sale.ValorLiquido : parseBrazilianCurrency(sale?.ValorLiquido);
          monthlyData[monthKey] = (monthlyData[monthKey] || 0) + valor;
        }
      }
    });

    return monthNames
      .filter(month => monthlyData[month] !== undefined)
      .map(month => ({
        month,
        value: monthlyData[month],
      }));
  }, [salesData, isConsolidated, sellerFilter]);

  const topProductsData = useMemo(() => {
    const salesList = extractSalesList(salesData, isConsolidated, sellerFilter);
    if (salesList.length === 0) return [];

    const productCounts: Record<string, number> = {};
    salesList.forEach((sale: any) => {
      if (sale.Itens && Array.isArray(sale.Itens)) {
        sale.Itens.forEach((item: any) => {
          const productName = item.DescricaoProduto || item.NomeProduto || 'Produto Sem Nome';
          const quantity = parseBrazilianCurrency(item.Quantidade) || 1;
          productCounts[productName] = (productCounts[productName] || 0) + quantity;
        });
      }
    });

    return Object.entries(productCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, sales]) => ({ name, sales }));
  }, [salesData, isConsolidated, sellerFilter]);

  const metrics = useMemo(() => {
    const clients = extractClientsList(clientsData, isConsolidated);
    const sales = extractSalesList(salesData, isConsolidated, sellerFilter);
    const products = extractProductsList(productsData, isConsolidated);
    const bills = extractBillsList(billsData, isConsolidated);

    return {
      totalClients: clients.length,
      totalSales: sales.reduce((sum: number, sale: any) => {
        const valor = typeof sale?.ValorLiquido === 'number' ? sale.ValorLiquido : parseBrazilianCurrency(sale?.ValorLiquido);
        return sum + valor;
      }, 0),
      totalProducts: products.length,
      totalBills: bills.reduce((sum: number, bill: any) => sum + parseBrazilianCurrency(bill?.Valor), 0),
    };
  }, [clientsData, salesData, productsData, billsData, isConsolidated, sellerFilter]);

  const canChangeStore = user?.role === "administrador" && !user?.storeId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-dashboard-title">
            Meu Saron
          </h1>
          <p className="text-muted-foreground mt-1">Visão geral do desempenho</p>
          {user?.role === "vendedor" && (
            <p className="text-sm text-muted-foreground mt-1">
              Você está visualizando apenas suas vendas
            </p>
          )}
          {user?.role !== "vendedor" && !canChangeStore && user?.storeId && (
            <p className="text-sm text-muted-foreground mt-1">
              Você está visualizando dados da sua loja: {user.storeId}
            </p>
          )}
        </div>
        {canChangeStore && <StoreSelector value={selectedStore} onChange={setSelectedStore} />}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={dataInicial}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
                      setDataInicial(value);
                      setCustomDateFilter(true);
                    }
                  }}
                  className="w-40"
                  data-testid="input-date-start"
                />
                <span className="text-sm text-muted-foreground">até</span>
                <Input
                  type="date"
                  value={dataFinal}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) {
                      setDataFinal(value);
                      setCustomDateFilter(true);
                    }
                  }}
                  className="w-40"
                  data-testid="input-date-end"
                />
              </div>
              {customDateFilter && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCustomDateFilter(false);
                    setDataInicial(thirtyDaysAgoStr);
                    setDataFinal(todayStr);
                  }}
                  data-testid="button-reset-dates"
                >
                  Limpar Filtro
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList data-testid="tabs-dashboard">
          <TabsTrigger value="resumo" data-testid="tab-resumo">Resumo</TabsTrigger>
          <TabsTrigger value="analises" data-testid="tab-analises">Análises</TabsTrigger>
          <TabsTrigger value="dados-completos" data-testid="tab-dados-completos">Dados Completos</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {loadingSales ? (
              <>
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </>
            ) : (
              <>
                <StatCard
                  title="Vendas Hoje"
                  value={`R$ ${periodSales.today.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={Calendar}
                  description={isConsolidated ? "todas as lojas" : "nesta loja"}
                  data-testid="stat-sales-today"
                />
                <StatCard
                  title="Vendas Semana"
                  value={`R$ ${periodSales.week.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={TrendingUp}
                  description={isConsolidated ? "todas as lojas" : "nesta loja"}
                  data-testid="stat-sales-week"
                />
                <StatCard
                  title="Vendas Mês"
                  value={`R$ ${periodSales.month.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={DollarSign}
                  description={isConsolidated ? "todas as lojas" : "nesta loja"}
                  data-testid="stat-sales-month"
                />
              </>
            )}
          </div>

          {dashboardGoals.length > 0 && (
            <Card data-testid="card-goals-progress">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  Progresso das Metas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingGoals ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16" />
                    <Skeleton className="h-16" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dashboardGoals.map((goal) => {
                      const storeLabels: Record<string, string> = {
                        saron1: "Saron 1",
                        saron2: "Saron 2", 
                        saron3: "Saron 3",
                      };
                      const cappedPercentage = Math.min(goal.percentage, 100);
                      const formatPeriod = () => {
                        const start = new Date(goal.weekStart + 'T00:00:00');
                        const end = new Date(goal.weekEnd + 'T00:00:00');
                        return `${format(start, 'dd/MM', { locale: ptBR })} - ${format(end, 'dd/MM', { locale: ptBR })}`;
                      };
                      
                      return (
                        <div 
                          key={goal.id} 
                          className="p-4 rounded-lg border bg-card"
                          data-testid={`goal-progress-${goal.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-sm">{storeLabels[goal.storeId] || goal.storeId}</span>
                                <Badge variant={goal.type === "individual" ? "default" : "secondary"} className="text-xs">
                                  {goal.type === "individual" ? "Individual" : "Conjunta"}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {goal.period === "weekly" ? "Semanal" : "Mensal"}
                                </Badge>
                              </div>
                              {goal.sellerName && (
                                <p className="text-xs text-muted-foreground mt-1">{goal.sellerName}</p>
                              )}
                              <p className="text-xs text-muted-foreground">{formatPeriod()}</p>
                            </div>
                            <div className="text-right">
                              <span className={`text-lg font-bold ${goal.isOnTrack ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {goal.percentage.toFixed(1)}%
                              </span>
                              <p className="text-xs text-muted-foreground">
                                Esperado: {goal.expectedPercentage.toFixed(0)}%
                              </p>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Progress 
                              value={cappedPercentage} 
                              className={`h-3 ${goal.isOnTrack ? '[&>div]:bg-green-600 dark:[&>div]:bg-green-500' : '[&>div]:bg-red-600 dark:[&>div]:bg-red-500'}`}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                              <span>R$ {goal.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              <span>Meta: R$ {goal.targetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Carregamento Otimizado</AlertTitle>
            <AlertDescription>
              Esta aba carrega apenas dados de vendas recentes. Para visualizar dados completos de clientes, produtos e contas, acesse a aba "Dados Completos".
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="analises" className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card data-testid="card-sales-chart">
              <CardHeader>
                <CardTitle className="text-lg font-display">Vendas por Mês</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSales ? (
                  <Skeleton className="h-[300px]" />
                ) : chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="month"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, "Vendas"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ fill: "hsl(var(--primary))", r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de vendas disponível
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-top-products">
              <CardHeader>
                <CardTitle className="text-lg font-display">Produtos Mais Vendidos</CardTitle>
              </CardHeader>
              <CardContent>
                {loadingSales ? (
                  <Skeleton className="h-[300px]" />
                ) : topProductsData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProductsData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={11}
                        width={120}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "6px",
                        }}
                        formatter={(value: number) => [`${value} unidades`, "Vendidos"]}
                      />
                      <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Nenhum dado de produtos disponível
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="dados-completos" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(loadingClients || loadingSales || loadingProducts || loadingBills) ? (
              <>
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
                <Skeleton className="h-32" />
              </>
            ) : (
              <>
                <StatCard
                  title="Clientes"
                  value={metrics.totalClients.toLocaleString('pt-BR')}
                  icon={Users}
                  description={isConsolidated ? "todas as lojas" : "nesta loja"}
                  data-testid="stat-clients"
                />
                <StatCard
                  title="Vendas"
                  value={`R$ ${metrics.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={ShoppingBag}
                  description={isConsolidated ? "todas as lojas" : "nesta loja"}
                  data-testid="stat-sales"
                />
                <StatCard
                  title="Produtos"
                  value={metrics.totalProducts.toLocaleString('pt-BR')}
                  icon={Package}
                  description={isConsolidated ? "todas as lojas" : "nesta loja"}
                  data-testid="stat-products"
                />
                <StatCard
                  title="Contas a Pagar"
                  value={`R$ ${metrics.totalBills.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={DollarSign}
                  description={isConsolidated ? "todas as lojas" : "nesta loja"}
                  data-testid="stat-bills"
                />
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
