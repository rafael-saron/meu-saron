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
import { StoreSelector } from "@/components/store-selector";
import { useDapicProdutos } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { parseBrazilianCurrency, formatBrazilianCurrency } from "@/lib/currency";

export default function Produtos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStore, setSelectedStore] = useState("saron1");

  const { data, isLoading, error } = useDapicProdutos(selectedStore);

  const isConsolidated = selectedStore === "todas";
  
  const productsList = isConsolidated && data?.stores
    ? Object.values(data.stores).flatMap((storeData: any) => storeData?.Dados || [])
    : (data?.Dados || []);

  const filteredProducts = productsList.filter((product: any) =>
    (product.Descricao || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (product.Codigo || '').toLowerCase().includes(searchTerm.toLowerCase())
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
        <StoreSelector value={selectedStore} onChange={setSelectedStore} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar produtos. Por favor, tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      )}

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
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum produto encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product: any, index: number) => {
                  const productId = product.Id || product.Codigo || index;
                  const stockQuantity = product.Estoque || product.EstoqueAtual || 0;
                  
                  return (
                    <TableRow key={productId} className="hover-elevate" data-testid={`row-product-${productId}`}>
                      <TableCell className="font-mono text-sm">{product.Codigo || '-'}</TableCell>
                      <TableCell className="font-medium">{product.Descricao || 'Produto sem descrição'}</TableCell>
                      <TableCell className="text-muted-foreground">{product.Referencia || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={stockQuantity < 15 ? "destructive" : "secondary"}>
                          {stockQuantity} un.
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {formatBrazilianCurrency(parseBrazilianCurrency(product.PrecoVenda))}
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
