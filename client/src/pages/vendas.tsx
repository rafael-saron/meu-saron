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

const mockSales = [
  { id: "BS230112165134WR", client: "João da Silva", date: "2024-01-15", status: "Fechado", total: 450.00, items: 3 },
  { id: "GG220621181318MS", client: "Maria Oliveira", date: "2024-01-14", status: "Aberto", total: 1790.00, items: 8 },
  { id: "NL210526180143LS", client: "Pedro Santos", date: "2024-01-13", status: "Fechado", total: 320.00, items: 2 },
  { id: "AB230115120045XY", client: "Ana Costa", date: "2024-01-12", status: "Cancelado", total: 680.00, items: 4 },
];

const statusColors = {
  "Fechado": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  "Aberto": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  "Cancelado": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default function Vendas() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSales = mockSales.filter((sale) =>
    sale.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    sale.client.toLowerCase().includes(searchTerm.toLowerCase())
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
        <Button data-testid="button-new-sale">
          <ShoppingCart className="h-4 w-4 mr-2" />
          Nova Venda
        </Button>
      </div>

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
              {filteredSales.map((sale) => (
                <TableRow key={sale.id} className="hover-elevate" data-testid={`row-sale-${sale.id}`}>
                  <TableCell className="font-mono text-sm">{sale.id}</TableCell>
                  <TableCell className="font-medium">{sale.client}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(sale.date).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColors[sale.status as keyof typeof statusColors]}>
                      {sale.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{sale.items}</TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {sale.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
