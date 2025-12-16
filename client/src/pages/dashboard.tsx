import { useState, useMemo, useEffect } from "react";
import { Users, ShoppingBag, Package, DollarSign, Calendar, TrendingUp, RefreshCw, ChevronDown, Database, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { StoreSelector } from "@/components/store-selector";
import { useDapicClientes, useDapicVendasPDV, useDapicProdutos, useDapicContasPagar } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency } from "@/lib/currency";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import type { ScheduleEvent, User } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

export default function Dashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [isSyncing, setIsSyncing] = useState(false);
  
  useEffect(() => {
    if (user && !selectedStore) {
      const defaultStore = user.role === "administrador" && !user.storeId ? "todas" : (user.storeId || "saron1");
      setSelectedStore(defaultStore);
    }
  }, [user, selectedStore]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  
  const { data: scheduleEvents = [] } = useQuery<ScheduleEvent[]>({
    queryKey: ['/api/schedule', todayStr, todayStr],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', todayStr);
      params.set('endDate', todayStr);
      const res = await fetch(`/api/schedule?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const userDayOff = useMemo(() => {
    if (!user || !scheduleEvents.length) return null;
    return scheduleEvents.find(event => 
      event.type === "folga" && event.userId === user.id
    );
  }, [user, scheduleEvents]);

  const todayScheduleForUser = useMemo(() => {
    if (!user || !scheduleEvents.length) return [];
    return scheduleEvents.filter(event => 
      event.type !== "folga" && 
      (event.userId === user.id || !event.userId)
    );
  }, [user, scheduleEvents]);

  const storeFolgas = useMemo(() => {
    if (!scheduleEvents.length) return [];
    return scheduleEvents.filter(event => event.type === "folga");
  }, [scheduleEvents]);

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Todos';
    const foundUser = allUsers.find(u => u.id === userId);
    return foundUser?.fullName || 'Funcionário';
  };

  const handleRefreshData = async (syncType: 'today' | 'month' | 'full' = 'today') => {
    setIsSyncing(true);
    try {
      const today = new Date();
      const isAllStores = selectedStore === "todas";
      
      let description = "";
      
      if (syncType === 'full') {
        await apiRequest("POST", "/api/sales/sync/full", {});
        description = "Sincronização completa do histórico concluída.";
      } else if (syncType === 'month') {
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const payload: { startDate: string; endDate: string; storeId?: string } = {
          startDate: monthStart.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
        if (!isAllStores) {
          payload.storeId = selectedStore;
        }
        await apiRequest("POST", "/api/sales/sync", payload);
        description = "Dados do mês atual sincronizados com sucesso.";
      } else {
        const payload: { startDate: string; endDate: string; storeId?: string } = {
          startDate: today.toISOString().split('T')[0],
          endDate: today.toISOString().split('T')[0]
        };
        if (!isAllStores) {
          payload.storeId = selectedStore;
        }
        await apiRequest("POST", "/api/sales/sync", payload);
        description = "Dados de hoje sincronizados com sucesso.";
      }

      await queryClient.invalidateQueries({ queryKey: ['/api/dapic'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/goals'] });
      await queryClient.invalidateQueries({ queryKey: ['/api/bonus'] });

      toast({
        title: "Dados atualizados",
        description,
      });
    } catch (error: any) {
      toast({
        title: "Erro na sincronização",
        description: error.message || "Não foi possível atualizar os dados.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const { data: clientsData, isLoading: loadingClients, error: clientsError } = useDapicClientes(selectedStore);
  const { data: salesData, isLoading: loadingSales, error: salesError } = useDapicVendasPDV(selectedStore);
  const { data: productsData, isLoading: loadingProducts, error: productsError } = useDapicProdutos(selectedStore);
  const { data: billsData, isLoading: loadingBills, error: billsError } = useDapicContasPagar(selectedStore);

  const isConsolidated = selectedStore === "todas";

  const consolidatedErrors = useMemo(() => {
    if (!isConsolidated) return null;
    const errors: Record<string, string[]> = {};
    
    if (clientsData?.errors && Object.keys(clientsData.errors).length > 0) {
      errors['clientes'] = Object.entries(clientsData.errors).map(([store, msg]) => `${store}: ${msg}`);
    }
    if (salesData?.errors && Object.keys(salesData.errors).length > 0) {
      errors['vendas'] = Object.entries(salesData.errors).map(([store, msg]) => `${store}: ${msg}`);
    }
    if (productsData?.errors && Object.keys(productsData.errors).length > 0) {
      errors['produtos'] = Object.entries(productsData.errors).map(([store, msg]) => `${store}: ${msg}`);
    }
    if (billsData?.errors && Object.keys(billsData.errors).length > 0) {
      errors['contas'] = Object.entries(billsData.errors).map(([store, msg]) => `${store}: ${msg}`);
    }

    return Object.keys(errors).length > 0 ? errors : null;
  }, [isConsolidated, clientsData, salesData, productsData, billsData]);

  const metrics = useMemo(() => {
    if (isConsolidated && clientsData?.stores) {
      const totalClients = Object.values(clientsData.stores).reduce((acc: number, storeData: any) => {
        return acc + (Array.isArray(storeData?.Resultado) ? storeData.Resultado.length : 0);
      }, 0);

      const totalSales = Object.values(salesData?.stores || {}).reduce((acc: number, storeData: any) => {
        const vendas = Array.isArray(storeData?.Dados) ? storeData.Dados : [];
        return acc + vendas.reduce((sum: number, venda: any) => {
          const valor = typeof venda?.ValorLiquido === 'number' ? venda.ValorLiquido : parseBrazilianCurrency(venda?.ValorLiquido);
          return sum + valor;
        }, 0);
      }, 0);

      const totalProducts = Object.values(productsData?.stores || {}).reduce((acc: number, storeData: any) => {
        return acc + (Array.isArray(storeData?.Dados) ? storeData.Dados.length : 0);
      }, 0);

      const totalBills = Object.values(billsData?.stores || {}).reduce((acc: number, storeData: any) => {
        const contas = Array.isArray(storeData?.Resultado) ? storeData.Resultado : [];
        return acc + contas.reduce((sum: number, conta: any) => sum + parseBrazilianCurrency(conta?.Valor), 0);
      }, 0);

      return {
        totalClients,
        totalSales,
        totalProducts,
        totalBills,
      };
    }

    const clients = Array.isArray(clientsData?.Resultado) ? clientsData.Resultado : [];
    const sales = Array.isArray(salesData?.Dados) ? salesData.Dados : [];
    const products = Array.isArray(productsData?.Dados) ? productsData.Dados : [];
    const bills = Array.isArray(billsData?.Resultado) ? billsData.Resultado : [];

    return {
      totalClients: clients.length,
      totalSales: sales.reduce((sum: number, sale: any) => {
        const valor = typeof sale?.ValorLiquido === 'number' ? sale.ValorLiquido : parseBrazilianCurrency(sale?.ValorLiquido);
        return sum + valor;
      }, 0),
      totalProducts: products.length,
      totalBills: bills.reduce((sum: number, bill: any) => sum + parseBrazilianCurrency(bill?.Valor), 0),
    };
  }, [clientsData, salesData, productsData, billsData, isConsolidated]);

  const chartData = useMemo(() => {
    if (!salesData) return [];

    const salesList = isConsolidated 
      ? Object.values(salesData.stores || {}).flatMap((storeData: any) => 
          Array.isArray(storeData?.Dados) ? storeData.Dados : [])
      : (Array.isArray(salesData?.Dados) ? salesData.Dados : []);

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
  }, [salesData, isConsolidated]);

  const periodSales = useMemo(() => {
    if (!salesData) return { today: 0, week: 0, month: 0 };

    const salesList = isConsolidated
      ? Object.values(salesData.stores || {}).flatMap((storeData: any) => 
          Array.isArray(storeData?.Dados) ? storeData.Dados : [])
      : (Array.isArray(salesData?.Dados) ? salesData.Dados : []);

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
  }, [salesData, isConsolidated]);

  const topProductsData = useMemo(() => {
    if (!salesData) return [];

    const salesList = isConsolidated
      ? Object.values(salesData.stores || {}).flatMap((storeData: any) => 
          Array.isArray(storeData?.Dados) ? storeData.Dados : [])
      : (Array.isArray(salesData?.Dados) ? salesData.Dados : []);

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
  }, [salesData, isConsolidated]);

  const canChangeStore = user?.role === "administrador" && !user?.storeId;

  const isLoading = loadingClients || loadingSales || loadingProducts || loadingBills;
  const hasError = clientsError || salesError || productsError || billsError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Visão geral do desempenho da Saron</p>
          {!canChangeStore && user?.storeId && (
            <p className="text-sm text-muted-foreground mt-1">
              Você está visualizando dados da sua loja: {user.storeId}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {user?.role === 'administrador' ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSyncing}
                  data-testid="button-refresh-data"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem 
                  onClick={() => handleRefreshData('today')}
                  disabled={isSyncing}
                  data-testid="menu-sync-today"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar Hoje
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleRefreshData('month')}
                  disabled={isSyncing}
                  data-testid="menu-sync-month"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Sincronizar Mês Atual
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleRefreshData('full')}
                  disabled={isSyncing}
                  data-testid="menu-sync-full"
                >
                  <Database className="h-4 w-4 mr-2" />
                  Sincronização Completa (Histórico)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefreshData('today')}
              disabled={isSyncing}
              data-testid="button-refresh-data"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Atualizando...' : 'Atualizar Dados'}
            </Button>
          )}
          {canChangeStore && <StoreSelector value={selectedStore} onChange={setSelectedStore} />}
        </div>
      </div>

      {hasError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar dados do dashboard. Por favor, tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      )}

      {consolidatedErrors && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Avisos de Dados Consolidados</AlertTitle>
          <AlertDescription>
            <div className="space-y-1 text-sm mt-2">
              {Object.entries(consolidatedErrors).map(([category, errors]) => (
                <div key={category}>
                  <strong className="capitalize">{category}:</strong>
                  <ul className="list-disc list-inside pl-2">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {userDayOff && (
        <div className="rounded-lg border-2 border-red-500 bg-red-50 dark:bg-red-950/50 p-6" data-testid="alert-day-off">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-red-500 p-3">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-red-700 dark:text-red-400">
                Hoje é seu dia de folga!
              </h2>
              <p className="text-red-600 dark:text-red-400 mt-1">
                {userDayOff.title}
                {userDayOff.description && ` - ${userDayOff.description}`}
              </p>
              <p className="text-sm text-red-500 dark:text-red-500 mt-2">
                Aproveite seu descanso! O sistema está disponível apenas para consulta.
              </p>
            </div>
          </div>
        </div>
      )}

      {todayScheduleForUser.length > 0 && !userDayOff && (
        <Card data-testid="card-today-schedule">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Seu horário de hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayScheduleForUser.map(event => {
                const startTime = new Date(event.startTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                const endTime = new Date(event.endTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={event.id} className="flex items-center gap-3 p-2 rounded-md bg-primary/10">
                    <div className="font-medium text-primary">{startTime} - {endTime}</div>
                    <div className="text-foreground">{event.title}</div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {storeFolgas.length > 0 && !userDayOff && (
        <Card data-testid="card-store-folgas">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Colegas de folga hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {storeFolgas.map(event => (
                <div 
                  key={event.id} 
                  className="px-3 py-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-sm"
                >
                  {getUserName(event.userId)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
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

      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="card-sales-chart">
          <CardHeader>
            <CardTitle className="text-lg font-display">Vendas por Mês</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
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
            {isLoading ? (
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
    </div>
  );
}
