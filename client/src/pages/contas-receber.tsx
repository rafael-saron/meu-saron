import { useState } from "react";
import { Search, Filter } from "lucide-react";
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
import { useDapicContasReceber } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency, formatBrazilianCurrency } from "@/lib/currency";

const statusColors = {
  "Pendente": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Recebido": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Vencido": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function ContasReceber() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState("saron1");

  const { data, isLoading, error } = useDapicContasReceber(selectedStore);

  const isConsolidated = selectedStore === "todas";
  
  const receivablesList = isConsolidated && data?.stores
    ? Object.values(data.stores).flatMap((storeData: any) => storeData?.Resultado || storeData?.Dados || storeData?.data?.Resultado || storeData?.data?.Dados || [])
    : (data?.Resultado || data?.Dados || data?.data?.Resultado || data?.data?.Dados || []);

  const filteredReceivables = receivablesList.filter((item: any) =>
    (item.Historico || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.Cliente || item.Pessoa || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Contas a Receber
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie seus recebimentos do Dapic</p>
        </div>
        <StoreSelector value={selectedStore} onChange={setSelectedStore} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar contas a receber. Por favor, tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição ou cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-receivables"
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
          ) : filteredReceivables.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conta a receber encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data de Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReceivables.map((item: any, index: number) => {
                  const itemId = item.Id || index;
                  const dueDate = item.DataVencimento ? new Date(item.DataVencimento) : null;
                  const today = new Date();
                  const isReceived = !!item.DataRecebimento || !!item.DataPagamento;
                  const isOverdue = dueDate && !isReceived && dueDate < today;
                  
                  let itemStatus = "Pendente";
                  if (isReceived) itemStatus = "Recebido";
                  else if (isOverdue) itemStatus = "Vencido";
                  
                  return (
                    <TableRow key={itemId} className="hover-elevate" data-testid={`row-receivable-${itemId}`}>
                      <TableCell className="font-medium">{item.Historico || 'Sem descrição'}</TableCell>
                      <TableCell className="text-muted-foreground">{item.Cliente || item.Pessoa || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {dueDate ? dueDate.toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[itemStatus as keyof typeof statusColors]}>
                          {itemStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {formatBrazilianCurrency(parseBrazilianCurrency(item.Valor))}
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
