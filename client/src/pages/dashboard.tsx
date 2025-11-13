import { useState, useMemo } from "react";
import { Users, ShoppingBag, Package, DollarSign } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";
import { StoreSelector } from "@/components/store-selector";
import { useDapicClientes, useDapicOrcamentos, useDapicProdutos, useDapicContasPagar } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency } from "@/lib/currency";

export default function Dashboard() {
  const [selectedStore, setSelectedStore] = useState("saron1");

  const { data: clientsData, isLoading: loadingClients, error: clientsError } = useDapicClientes(selectedStore);
  const { data: salesData, isLoading: loadingSales, error: salesError } = useDapicOrcamentos(selectedStore);
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
        const orcamentos = Array.isArray(storeData?.Resultado) ? storeData.Resultado : [];
        return acc + orcamentos.reduce((sum: number, orc: any) => sum + parseBrazilianCurrency(orc?.ValorTotal), 0);
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
    const sales = Array.isArray(salesData?.Resultado) ? salesData.Resultado : [];
    const products = Array.isArray(productsData?.Dados) ? productsData.Dados : [];
    const bills = Array.isArray(billsData?.Resultado) ? billsData.Resultado : [];

    return {
      totalClients: clients.length,
      totalSales: sales.reduce((sum: number, sale: any) => sum + parseBrazilianCurrency(sale?.ValorTotal), 0),
      totalProducts: products.length,
      totalBills: bills.reduce((sum: number, bill: any) => sum + parseBrazilianCurrency(bill?.Valor), 0),
    };
  }, [clientsData, salesData, productsData, billsData, isConsolidated]);

  const chartData = useMemo(() => {
    if (!salesData) return [];

    const salesList = isConsolidated 
      ? Object.values(salesData.stores || {}).flatMap((storeData: any) => 
          Array.isArray(storeData?.Resultado) ? storeData.Resultado : [])
      : (Array.isArray(salesData?.Resultado) ? salesData.Resultado : []);

    const monthlyData: Record<string, number> = {};
    const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    
    salesList.forEach((sale: any) => {
      if (sale.DataEmissao) {
        try {
          const date = new Date(sale.DataEmissao);
          if (!isNaN(date.getTime())) {
            const monthIndex = date.getMonth();
            const monthKey = monthNames[monthIndex];
            monthlyData[monthKey] = (monthlyData[monthKey] || 0) + parseBrazilianCurrency(sale.ValorTotal);
          }
        } catch (e) {
          console.error('Error parsing date:', e);
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
          Array.isArray(storeData?.Resultado) ? storeData.Resultado : [])
      : (Array.isArray(salesData?.Resultado) ? salesData.Resultado : []);

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

  const isLoading = loadingClients || loadingSales || loadingProducts || loadingBills;
  const hasError = clientsError || salesError || productsError || billsError;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">Visão geral do desempenho da Saron</p>
        </div>
        <StoreSelector value={selectedStore} onChange={setSelectedStore} />
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
