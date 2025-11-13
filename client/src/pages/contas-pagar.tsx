import { useState } from "react";
import { Search, Filter, DollarSign } from "lucide-react";
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
import { useDapicContasPagar } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency, formatBrazilianCurrency } from "@/lib/currency";

const statusColors = {
  "Pendente": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Pago": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Vencido": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function ContasPagar() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState("saron1");

  const { data, isLoading, error } = useDapicContasPagar(selectedStore);

  const isConsolidated = selectedStore === "todas";
  
  const billsList = isConsolidated && data?.stores
    ? Object.values(data.stores).flatMap((storeData: any) => storeData?.Resultado || [])
    : (data?.Resultado || []);

  const filteredBills = billsList.filter((bill: any) =>
    (bill.Historico || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (bill.Fornecedor || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Contas a Pagar
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie seus pagamentos do Dapic</p>
        </div>
        <StoreSelector value={selectedStore} onChange={setSelectedStore} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar contas a pagar. Por favor, tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-bills"
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
          ) : filteredBills.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma conta a pagar encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Data de Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBills.map((bill: any, index: number) => {
                  const billId = bill.Id || index;
                  const dueDate = bill.DataVencimento ? new Date(bill.DataVencimento) : null;
                  const today = new Date();
                  const isPaid = !!bill.DataPagamento;
                  const isOverdue = dueDate && !isPaid && dueDate < today;
                  
                  let billStatus = "Pendente";
                  if (isPaid) billStatus = "Pago";
                  else if (isOverdue) billStatus = "Vencido";
                  
                  return (
                    <TableRow key={billId} className="hover-elevate" data-testid={`row-bill-${billId}`}>
                      <TableCell className="font-medium">{bill.Historico || 'Sem descrição'}</TableCell>
                      <TableCell className="text-muted-foreground">{bill.Fornecedor || '-'}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {dueDate ? dueDate.toLocaleDateString('pt-BR') : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[billStatus as keyof typeof statusColors]}>
                          {billStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {formatBrazilianCurrency(parseBrazilianCurrency(bill.Valor))}
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
