import { useState } from "react";
import { Search, Filter, ShoppingCart } from "lucide-react";
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
import { useDapicOrcamentos } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency, formatBrazilianCurrency } from "@/lib/currency";

const statusColors = {
  "Fechado": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Aberto": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "Cancelado": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function Vendas() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState("saron1");

  const { data, isLoading, error } = useDapicOrcamentos(selectedStore);

  const isConsolidated = selectedStore === "todas";
  
  const salesList = isConsolidated && data?.stores
    ? Object.values(data.stores).flatMap((storeData: any) => storeData?.Resultado || [])
    : (data?.Resultado || []);

  const filteredSales = salesList.filter((sale: any) =>
    (sale.Numero || '').toString().toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sale.NomeCliente || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Vendas e Orçamentos
          </h1>
          <p className="text-muted-foreground mt-1">Acompanhe suas vendas do Dapic</p>
        </div>
        <StoreSelector value={selectedStore} onChange={setSelectedStore} />
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
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-sales"
              />
            </div>
            <Button variant="outline" size="icon" data-testid="button-filter">
              <Filter className="h-4 w-4" />
            </Button>
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
              Nenhuma venda encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSales.map((sale: any, index: number) => {
                  const saleId = sale.Id || sale.Numero || index;
                  const itemCount = sale.Itens?.length || 0;
                  const saleStatus = sale.Situacao || (sale.DataFechamento ? "Fechado" : "Aberto");
                  
                  return (
                    <TableRow key={saleId} className="hover-elevate" data-testid={`row-sale-${saleId}`}>
                      <TableCell className="font-mono text-sm">{sale.Numero || saleId}</TableCell>
                      <TableCell className="font-medium">{sale.NomeCliente || 'Cliente não informado'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {sale.DataEmissao ? new Date(sale.DataEmissao).toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[saleStatus as keyof typeof statusColors] || "bg-gray-100 text-gray-800"}>
                          {saleStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{itemCount}</TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {formatBrazilianCurrency(parseBrazilianCurrency(sale.ValorTotal))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
