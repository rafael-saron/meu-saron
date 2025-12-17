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

// Formata valor com 2 casas decimais e arredondamento especial
// Se 3º dígito ≤5, arredonda para baixo; se >5, arredonda para cima
function formatBonusValue(value: number): string {
  // Multiplica por 100 para trabalhar com os dígitos
  const shifted = value * 100;
  const thirdDigit = Math.floor((shifted * 10) % 10);
  
  // Se o 3º dígito for ≤5, arredonda para baixo (floor)
  // Se for >5, arredonda para cima (ceil)
  let rounded: number;
  if (thirdDigit <= 5) {
    rounded = Math.floor(shifted) / 100;
  } else {
    rounded = Math.ceil(shifted) / 100;
  }
  
  return rounded.toLocaleString('pt-BR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
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
    type: "individual" | "team" | "aggregated";
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
    goalsCount?: number;
    bonusPercentageAchieved: number | null;
    bonusPercentageNotAchieved: number | null;
    estimatedBonus: number | null;
  }

  const goalsQueryUrl = `/api/goals/dashboard?storeId=${encodeURIComponent(selectedStore || '')}`;
  const { data: dashboardGoals = [], isLoading: loadingGoals } = useQuery<DashboardGoal[]>({
    queryKey: [goalsQueryUrl],
    enabled: !!selectedStore,
    refetchInterval: 60000,
  });

  interface BonusSummary {
    weekly: {
      vendorBonus: number;
      managerBonus: number;
      cashierBonus: number;
      total: number;
      period: { start: string; end: string };
    };
    monthly: {
      vendorBonus: number;
      managerBonus: number;
      cashierBonus: number;
      total: number;
      period: { start: string; end: string };
    };
  }

  const bonusSummaryUrl = `/api/bonus/summary?storeId=${encodeURIComponent(selectedStore || '')}`;
  const { data: bonusSummary, isLoading: loadingBonus, isError: bonusError } = useQuery<BonusSummary>({
    queryKey: [bonusSummaryUrl],
    enabled: !!selectedStore && user?.role === 'administrador' && activeTab === "resumo",
    refetchInterval: 60000,
  });

  interface SalesSummary {
    today: number;
    week: number;
    month: number;
    todayCount: number;
    weekCount: number;
    monthCount: number;
    periods: {
      today: string;
      weekStart: string;
      weekEnd: string;
      monthStart: string;
      monthEnd: string;
    };
  }

  const salesSummaryUrl = `/api/sales/summary?storeId=${encodeURIComponent(selectedStore || '')}`;
  const { data: salesSummary, isLoading: loadingSalesSummary } = useQuery<SalesSummary>({
    queryKey: [salesSummaryUrl],
    enabled: !!selectedStore && activeTab === "resumo" && user?.role !== 'caixa',
    refetchInterval: 60000,
  });

  // Cashier dashboard data
  interface CashierDashboard {
    hasGoal: boolean;
    message?: string;
    weekStart: string;
    weekEnd: string;
    goal?: {
      id: string;
      storeId: string;
      paymentMethods: string[];
      targetPercentage: number;
      currentPercentage: number;
      isGoalMet: boolean;
      isOnTrack: boolean;
      elapsedDays: number;
      totalDays: number;
      expectedPercentage: number;
      totalStoreSales: number;
      targetMethodSales: number;
      bonusPercentageAchieved: number;
      bonusPercentageNotAchieved: number;
    };
    salesByMethod?: Array<{ method: string; total: number }>;
  }

  const { data: cashierDashboard, isLoading: loadingCashierDashboard } = useQuery<CashierDashboard>({
    queryKey: ['/api/cashier/dashboard'],
    enabled: user?.role === 'caixa',
    refetchInterval: 60000,
  });

  const periodSales = useMemo(() => {
    if (salesSummary) {
      return {
        today: salesSummary.today,
        week: salesSummary.week,
        month: salesSummary.month,
      };
    }
    return { today: 0, week: 0, month: 0 };
  }, [salesSummary]);

  const isConsolidated = selectedStore === "todas";

  // Vendedores da saron2 têm metas conjuntas, então veem todas as vendas da loja
  const isSaron2Seller = user?.role === "vendedor" && user?.storeId === "saron2";
  const sellerFilter = user?.role === "vendedor" && !isSaron2Seller ? user.fullName : undefined;

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
          {user?.role === "vendedor" && !isSaron2Seller && (
            <p className="text-sm text-muted-foreground mt-1">
              Você está visualizando apenas suas vendas
            </p>
          )}
          {isSaron2Seller && (
            <p className="text-sm text-muted-foreground mt-1">
              Você está visualizando todas as vendas da loja (meta conjunta)
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

      {/* Cashier-specific dashboard */}
      {user?.role === 'caixa' && (
        <div className="space-y-6">
          {loadingCashierDashboard ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-64" />
            </div>
          ) : !cashierDashboard?.hasGoal ? (
            <Card data-testid="card-no-goal">
              <CardContent className="py-12 text-center">
                <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma Meta Esta Semana</h3>
                <p className="text-muted-foreground">
                  {cashierDashboard?.message || "Você ainda não possui metas de caixa para esta semana."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Goal Progress Card */}
              <Card data-testid="card-goal-progress">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Meta Semanal - {cashierDashboard.goal?.paymentMethods.map(m => m.toUpperCase()).join(', ')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Progresso</span>
                    <span className="text-sm font-medium">
                      {cashierDashboard.goal?.currentPercentage.toFixed(1)}% / {cashierDashboard.goal?.targetPercentage}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(cashierDashboard.goal?.currentPercentage || 0, 100)} 
                    className="h-4"
                  />
                  <div className="flex items-center justify-between text-sm">
                    <Badge 
                      variant={cashierDashboard.goal?.isOnTrack ? "default" : "destructive"}
                      className={cashierDashboard.goal?.isOnTrack ? "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20" : ""}
                      data-testid="badge-on-track"
                    >
                      {cashierDashboard.goal?.isOnTrack ? "No Ritmo" : "Abaixo do Esperado"}
                    </Badge>
                    <span className="text-muted-foreground">
                      Dia {cashierDashboard.goal?.elapsedDays} de {cashierDashboard.goal?.totalDays}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Sales Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard
                  title="Vendas Totais (Loja)"
                  value={`R$ ${(cashierDashboard.goal?.totalStoreSales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={DollarSign}
                  description="esta semana"
                  data-testid="stat-total-store-sales"
                />
                <StatCard
                  title="Vendas nos Meios"
                  value={`R$ ${(cashierDashboard.goal?.targetMethodSales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                  icon={TrendingUp}
                  description={cashierDashboard.goal?.paymentMethods.join(', ')}
                  data-testid="stat-target-method-sales"
                />
                <StatCard
                  title="Percentual Atual"
                  value={`${(cashierDashboard.goal?.currentPercentage || 0).toFixed(1)}%`}
                  icon={Target}
                  description={`Meta: ${cashierDashboard.goal?.targetPercentage}%`}
                  data-testid="stat-current-percentage"
                />
              </div>

              {/* Payment Method Breakdown */}
              {cashierDashboard.salesByMethod && cashierDashboard.salesByMethod.length > 0 && (
                <Card data-testid="card-payment-breakdown">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      Vendas por Método de Pagamento
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {cashierDashboard.salesByMethod.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-lg border bg-card" data-testid={`row-payment-method-${idx}`}>
                          <span className="font-medium">{item.method}</span>
                          <span className="text-lg font-bold text-foreground">
                            R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Bonus Information */}
              <Card data-testid="card-bonus-info">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-yellow-500" />
                    Bonificação
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg border bg-green-50 dark:bg-green-950/20">
                      <p className="text-sm text-muted-foreground">Se atingir a meta</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {cashierDashboard.goal?.bonusPercentageAchieved}% das vendas
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        ≈ R$ {((cashierDashboard.goal?.bonusPercentageAchieved || 0) / 100 * (cashierDashboard.goal?.targetMethodSales || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-950/20">
                      <p className="text-sm text-muted-foreground">Se não atingir</p>
                      <p className="text-xl font-bold text-red-600 dark:text-red-400">
                        {cashierDashboard.goal?.bonusPercentageNotAchieved}% das vendas
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        ≈ R$ {((cashierDashboard.goal?.bonusPercentageNotAchieved || 0) / 100 * (cashierDashboard.goal?.targetMethodSales || 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Non-cashier dashboard */}
      {user?.role !== 'caixa' && (
      <>
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
          {user?.role !== 'vendedor' && (
            <TabsTrigger value="dados-completos" data-testid="tab-dados-completos">Dados Completos</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="resumo" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {loadingSalesSummary ? (
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
                        "Todas as Lojas": "Todas as Lojas",
                        "Suas Lojas": "Suas Lojas",
                      };
                      const cappedPercentage = Math.min(goal.percentage, 100);
                      const formatPeriod = () => {
                        const start = new Date(goal.weekStart + 'T00:00:00');
                        const end = new Date(goal.weekEnd + 'T00:00:00');
                        return `${format(start, 'dd/MM', { locale: ptBR })} - ${format(end, 'dd/MM', { locale: ptBR })}`;
                      };

                      const isAggregated = goal.type === 'aggregated';
                      const periodLabel = goal.period === "weekly" ? "Semanal" : "Mensal";
                      const typeLabel = isAggregated ? "Progresso Total" : (goal.type === "individual" ? "Individual" : "Conjunta");
                      
                      return (
                        <div 
                          key={goal.id} 
                          className={`p-4 rounded-lg border ${isAggregated ? 'bg-primary/5 border-primary/20' : 'bg-card'}`}
                          data-testid={`goal-progress-${goal.id}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {isAggregated ? (
                                  <>
                                    <span className="font-semibold text-sm text-primary">
                                      Meta {periodLabel}
                                    </span>
                                    <Badge variant="default" className="text-xs bg-primary">
                                      {typeLabel}
                                    </Badge>
                                    {goal.goalsCount && goal.goalsCount > 1 && (
                                      <Badge variant="outline" className="text-xs">
                                        {goal.goalsCount} metas
                                      </Badge>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="font-medium text-sm">{storeLabels[goal.storeId] || goal.storeId}</span>
                                    <Badge variant={goal.type === "individual" ? "default" : "secondary"} className="text-xs">
                                      {typeLabel}
                                    </Badge>
                                    <Badge variant="outline" className="text-xs">
                                      {periodLabel}
                                    </Badge>
                                  </>
                                )}
                              </div>
                              {goal.sellerName && (
                                <p className="text-xs text-muted-foreground mt-1">{goal.sellerName}</p>
                              )}
                              {isAggregated && (
                                <p className="text-xs text-muted-foreground mt-1">{storeLabels[goal.storeId] || goal.storeId}</p>
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
                          {goal.estimatedBonus !== null && goal.type === 'individual' && (
                            <div className="mt-3 pt-3 border-t border-border/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    Bonificação Estimada
                                  </span>
                                  <Badge 
                                    variant={goal.percentage >= 100 ? "default" : "secondary"} 
                                    className="text-xs"
                                  >
                                    {goal.percentage >= 100 
                                      ? `${goal.bonusPercentageAchieved?.toFixed(1)}%` 
                                      : `${goal.bonusPercentageNotAchieved?.toFixed(1)}%`
                                    }
                                  </Badge>
                                </div>
                                <span className={`text-lg font-bold ${goal.percentage >= 100 ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                                  R$ {formatBonusValue(goal.estimatedBonus)}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {goal.percentage >= 100 
                                  ? "Meta batida! Esse é o valor da sua bonificação." 
                                  : "Valor atual. Bata a meta para receber a bonificação completa!"
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {user?.role === 'administrador' && (
            <Card data-testid="card-bonus-summary">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" />
                  Resumo de Bonificações
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBonus ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                  </div>
                ) : bonusError ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Erro ao carregar resumo de bonificações
                  </div>
                ) : !bonusSummary ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    Selecione uma loja para visualizar as bonificações
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Bonificação Semanal</span>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(bonusSummary.weekly.period.start + 'T00:00:00'), 'dd/MM', { locale: ptBR })} - {format(new Date(bonusSummary.weekly.period.end + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Vendedores</span>
                          <span className="font-medium">R$ {formatBonusValue(bonusSummary.weekly.vendorBonus)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gerentes</span>
                          <span className="font-medium">R$ {formatBonusValue(bonusSummary.weekly.managerBonus)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Caixas</span>
                          <span className="font-medium">R$ {formatBonusValue(bonusSummary.weekly.cashierBonus)}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                          <span className="font-semibold">Total Semanal</span>
                          <span className="font-bold text-primary">R$ {formatBonusValue(bonusSummary.weekly.total)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 rounded-lg border bg-card">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium text-muted-foreground">Bonificação Mensal</span>
                        <Badge variant="outline" className="text-xs">
                          {format(new Date(bonusSummary.monthly.period.start + 'T00:00:00'), 'dd/MM', { locale: ptBR })} - {format(new Date(bonusSummary.monthly.period.end + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Vendedores</span>
                          <span className="font-medium">R$ {formatBonusValue(bonusSummary.monthly.vendorBonus)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Gerentes</span>
                          <span className="font-medium">R$ {formatBonusValue(bonusSummary.monthly.managerBonus)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Caixas</span>
                          <span className="font-medium">R$ {formatBonusValue(bonusSummary.monthly.cashierBonus)}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-2 border-t border-border/50">
                          <span className="font-semibold">Total Mensal</span>
                          <span className="font-bold text-primary">R$ {formatBonusValue(bonusSummary.monthly.total)}</span>
                        </div>
                      </div>
                    </div>
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
      </>
      )}
    </div>
  );
}
