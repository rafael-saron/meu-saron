import { useState } from "react";
import { Search, Filter, Package } from "lucide-react";
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

const mockProducts = [
  { id: 1, code: "20230112-01", name: "Camiseta estampada", color: "Branco", size: "P", stock: 45, price: 89.90 },
  { id: 2, code: "20230112-02", name: "Calça Jeans Slim", color: "Azul", size: "38", stock: 23, price: 189.90 },
  { id: 3, code: "20230112-03", name: "Vestido Floral", color: "Floral", size: "M", stock: 12, price: 149.90 },
  { id: 4, code: "20230112-04", name: "Jaqueta de Couro", color: "Preto", size: "G", stock: 8, price: 349.90 },
  { id: 5, code: "20230112-05", name: "Camisa Social", color: "Branco", size: "M", stock: 31, price: 119.90 },
];

export default function Produtos() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = mockProducts.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Produtos e Estoque
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie o catálogo de produtos do Dapic</p>
        </div>
        <Button data-testid="button-add-product">
          <Package className="h-4 w-4 mr-2" />
          Novo Produto
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-products"
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
                <TableHead>Produto</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead>Tamanho</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Preço</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => (
                <TableRow key={product.id} className="hover-elevate" data-testid={`row-product-${product.id}`}>
                  <TableCell className="font-mono text-sm">{product.code}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.color}</TableCell>
                  <TableCell className="text-muted-foreground">{product.size}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={product.stock < 15 ? "destructive" : "secondary"}>
                      {product.stock} un.
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {product.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
