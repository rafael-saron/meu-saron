import { useState, useMemo, useEffect } from "react";
import { Users, ShoppingBag, Package, DollarSign, Calendar, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { StoreSelector } from "@/components/store-selector";
import { useDapicClientes, useDapicVendasPDV, useDapicProdutos, useDapicContasPagar } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency } from "@/lib/currency";
import { useUser } from "@/lib/user-context";

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
  const [selectedStore, setSelectedStore] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("resumo");
  
  useEffect(() => {
    if (user && !selectedStore) {
      const defaultStore = user.role === "administrador" && !user.storeId ? "todas" : (user.storeId || "saron1");
      setSelectedStore(defaultStore);
    }
  }, [user, selectedStore]);

  const enableSalesData = activeTab === "resumo" || activeTab === "analises";
  const enableClientsData = activeTab === "dados-completos";
  const enableProductsData = activeTab === "dados-completos";
  const enableBillsData = activeTab === "dados-completos";

  const { data: clientsData, isLoading: loadingClients } = useDapicClientes(selectedStore, { enabled: enableClientsData });
  const { data: salesData, isLoading: loadingSales } = useDapicVendasPDV(selectedStore, { enabled: enableSalesData });
  const { data: productsData, isLoading: loadingProducts } = useDapicProdutos(selectedStore, { enabled: enableProductsData });
  const { data: billsData, isLoading: loadingBills } = useDapicContasPagar(selectedStore, { enabled: enableBillsData });

  const isConsolidated = selectedStore === "todas";

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

  const metrics = useMemo(() => {
    if (isConsolidated && clientsData?.stores) {
      const totalClients = Object.values(clientsData.stores).reduce((acc: number, storeData: any) => {
        return acc + (Array.isArray(storeData?.Dados) ? storeData.Dados.length : 0);
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

  const canChangeStore = user?.role === "administrador" && !user?.storeId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-dashboard-title">
            Meu Saron
          </h1>
          <p className="text-muted-foreground mt-1">Visão geral do desempenho</p>
          {!canChangeStore && user?.storeId && (
            <p className="text-sm text-muted-foreground mt-1">
              Você está visualizando dados da sua loja: {user.storeId}
            </p>
          )}
        </div>
        {canChangeStore && <StoreSelector value={selectedStore} onChange={setSelectedStore} />}
      </div>

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
