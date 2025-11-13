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

const mockBills = [
  { id: 1, description: "Fornecedor ABC Tecidos", dueDate: "2024-01-20", amount: 3450.00, status: "Pendente" },
  { id: 2, description: "Aluguel Loja Centro", dueDate: "2024-01-25", amount: 5500.00, status: "Pendente" },
  { id: 3, description: "Energia Elétrica", dueDate: "2024-01-18", amount: 890.50, status: "Vencido" },
  { id: 4, description: "Fornecedor XYZ Aviamentos", dueDate: "2024-01-15", amount: 2100.00, status: "Pago" },
  { id: 5, description: "Água", dueDate: "2024-01-22", amount: 345.80, status: "Pendente" },
];

const statusColors = {
  "Pendente": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  "Pago": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Vencido": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function ContasPagar() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredBills = mockBills.filter((bill) =>
    bill.description.toLowerCase().includes(searchTerm.toLowerCase())
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
        <Button data-testid="button-add-bill">
          <DollarSign className="h-4 w-4 mr-2" />
          Nova Conta
        </Button>
      </div>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Data de Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredBills.map((bill) => (
                <TableRow key={bill.id} className="hover-elevate" data-testid={`row-bill-${bill.id}`}>
                  <TableCell className="font-medium">{bill.description}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(bill.dueDate).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[bill.status as keyof typeof statusColors]}>
                      {bill.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {bill.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
