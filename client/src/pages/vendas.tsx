import { useState, useMemo, useEffect } from "react";
import { Search, DollarSign, ShoppingCart, TrendingUp, Calendar, CalendarDays } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StoreSelector } from "@/components/store-selector";
import { useDapicVendasPDV } from "@/hooks/use-dapic";
import { useUser } from "@/lib/user-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const normalizeValue = (value: any): number => {
  if (!value) return 0;
  
  if (typeof value === 'number') return value;
  
  const stringValue = String(value);
  const normalized = stringValue
    .replace(/[^\d,-]/g, '')
    .replace(',', '.');
  
  const parsed = parseFloat(normalized);
  return isNaN(parsed) ? 0 : parsed;
};

export default function Vendas() {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState("todas");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const [dataInicial, setDataInicial] = useState(format(thirtyDaysAgo, 'yyyy-MM-dd'));
  const [dataFinal, setDataFinal] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [debouncedDataInicial, setDebouncedDataInicial] = useState(format(thirtyDaysAgo, 'yyyy-MM-dd'));
  const [debouncedDataFinal, setDebouncedDataFinal] = useState(format(new Date(), 'yyyy-MM-dd'));
  
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
  
  const { data, isLoading, error } = useDapicVendasPDV(selectedStore, {
    DataInicial: debouncedDataInicial,
    DataFinal: debouncedDataFinal,
  });

  const isConsolidated = selectedStore === "todas";
  
  // For vendedor role, filter sales by their name
  const sellerFilter = user?.role === "vendedor" ? user.fullName : undefined;
  
  const salesList = useMemo(() => {
    if (!data) return [];
    
    let sales: any[] = [];
    
    if (isConsolidated && data.stores) {
      sales = Object.values(data.stores).flatMap((storeData: any) => 
        Array.isArray(storeData?.Dados) ? storeData.Dados : []
      );
    } else if (Array.isArray(data?.Dados)) {
      sales = data.Dados;
    }
    
    // Filter by seller name for vendedor role
    if (sellerFilter) {
      const normalizedFilter = sellerFilter.toLowerCase().trim();
      sales = sales.filter((sale: any) => {
        const sellerName = (sale.NomeVendedor || sale.Vendedor || '').toLowerCase().trim();
        return sellerName === normalizedFilter;
      });
    }
    
    return sales;
  }, [data, isConsolidated, sellerFilter]);

  const stats = useMemo(() => {
    const total = salesList.reduce((sum: number, sale: any) => 
      sum + normalizeValue(sale.ValorLiquido ?? sale.ValorTotal), 0
    );
    const count = salesList.length;
    const average = count > 0 ? total / count : 0;

    return {
      total,
      count,
      average,
    };
  }, [salesList]);

  const filteredSales = useMemo(() => {
    return salesList.filter((sale: any) => {
      const searchLower = searchTerm.toLowerCase();
      const nomeCliente = (sale.NomeCliente || sale.Cliente || '').toLowerCase();
      const codigo = (sale.Codigo || '').toString().toLowerCase();
      const vendedor = (sale.NomeVendedor || sale.Vendedor || '').toLowerCase();
      
      return nomeCliente.includes(searchLower) || 
             codigo.includes(searchLower) ||
             vendedor.includes(searchLower);
    });
  }, [salesList, searchTerm]);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage) || 1;
  
  useEffect(() => {
    if (currentPage > totalPages && filteredSales.length > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, filteredSales.length]);

  const safePage = Math.min(currentPage, totalPages);
  const paginatedSales = filteredSales.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "dd/MM/yyyy HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Vendas PDV
          </h1>
          <p className="text-muted-foreground mt-1">
            {filteredSales.length.toLocaleString('pt-BR')} vendas
          </p>
          {user?.role === "vendedor" && (
            <p className="text-sm text-muted-foreground">
              Você está visualizando apenas suas vendas
            </p>
          )}
        </div>
        <StoreSelector value={selectedStore} onChange={setSelectedStore} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Total Vendido</h3>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sales">
              {formatCurrency(stats.total)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Quantidade</h3>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-sales-count">
              {stats.count.toLocaleString('pt-BR')}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Ticket Médio</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-average-ticket">
              {formatCurrency(stats.average)}
            </div>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar vendas. Por favor, tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="space-y-4">
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
                    }
                  }}
                  className="w-40"
                  data-testid="input-date-end"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por cliente, código ou vendedor..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                  data-testid="input-search-sales"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma venda encontrada</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                      <TableHead className="text-right">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSales.map((sale: any, index: number) => {
                      const saleId = sale.Id || sale.Codigo || index;
                      const valorTotal = normalizeValue(sale.ValorLiquido ?? sale.ValorTotal);
                      const dataVenda = sale.DataFechamento || sale.DataEmissao || sale.Data;
                      const nomeCliente = sale.NomeCliente || sale.Cliente || 'Cliente não informado';
                      const nomeVendedor = sale.NomeVendedor || sale.Vendedor || '-';
                      
                      return (
                        <TableRow key={saleId} className="hover-elevate" data-testid={`row-sale-${saleId}`}>
                          <TableCell className="font-mono text-sm">{sale.Codigo || '-'}</TableCell>
                          <TableCell className="text-sm">{dataVenda ? formatDate(dataVenda) : '-'}</TableCell>
                          <TableCell className="font-medium">{nomeCliente}</TableCell>
                          <TableCell className="text-sm">{nomeVendedor}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(valorTotal)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={sale.Status === 'Finalizada' ? 'default' : 'secondary'}>
                              {sale.Status || 'Fechada'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    Exibindo {((safePage - 1) * itemsPerPage) + 1}-{Math.min(safePage * itemsPerPage, filteredSales.length)} de {filteredSales.length} vendas
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      data-testid="button-previous-page"
                    >
                      Anterior
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Página {safePage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      data-testid="button-next-page"
                    >
                      Próxima
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
