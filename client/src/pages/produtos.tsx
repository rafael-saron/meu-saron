import { useState, useMemo, useEffect } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
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
import { useDapicProdutos } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type SortOrder = 'asc' | 'desc' | null;

export default function Produtos() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const { data, isLoading, error } = useDapicProdutos("todas");
  
  const productsList = data?.stores
    ? Object.values(data.stores).flatMap((storeData: any) => storeData?.Dados || [])
    : [];

  const filteredProducts = useMemo(() => {
    let filtered = productsList.filter((product: any) =>
      (product.DescricaoFabrica || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.Referencia || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (sortOrder) {
      filtered = [...filtered].sort((a, b) => {
        const nameA = (a.DescricaoFabrica || '').toLowerCase();
        const nameB = (b.DescricaoFabrica || '').toLowerCase();
        return sortOrder === 'asc' 
          ? nameA.localeCompare(nameB)
          : nameB.localeCompare(nameA);
      });
    }

    return filtered;
  }, [productsList, searchTerm, sortOrder]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage) || 1;
  
  useEffect(() => {
    if (currentPage > totalPages && filteredProducts.length > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, filteredProducts.length]);

  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * itemsPerPage,
    safePage * itemsPerPage
  );

  const toggleSortOrder = () => {
    setSortOrder(current => {
      if (current === null) return 'asc';
      if (current === 'asc') return 'desc';
      return null;
    });
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Produtos e Estoque
          </h1>
          <p className="text-muted-foreground mt-1">Catálogo unificado de produtos ({productsList.length.toLocaleString('pt-BR')} itens)</p>
        </div>
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
                placeholder="Buscar por nome ou referência..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
                data-testid="input-search-products"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={toggleSortOrder}
              data-testid="button-sort-order"
            >
              {sortOrder === null && (
                <>
                  <ArrowUpDown className="h-4 w-4 mr-2" />
                  Ordenar
                </>
              )}
              {sortOrder === 'asc' && (
                <>
                  <ArrowUp className="h-4 w-4 mr-2" />
                  A-Z
                </>
              )}
              {sortOrder === 'desc' && (
                <>
                  <ArrowDown className="h-4 w-4 mr-2" />
                  Z-A
                </>
              )}
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
                  <TableHead>Referência</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map((product: any, index: number) => {
                  const productId = product.Id || product.Referencia || index;
                  
                  return (
                    <TableRow key={productId} className="hover-elevate" data-testid={`row-product-${productId}`}>
                      <TableCell className="font-mono text-sm">{product.Referencia || '-'}</TableCell>
                      <TableCell className="font-medium">{product.DescricaoFabrica || 'Produto sem descrição'}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{product.DescricaoTipoProduto || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={product.Status === 'Ativo' ? "default" : "secondary"}>
                          {product.Status || 'Desconhecido'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {filteredProducts.length > 0 && (
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <div className="text-sm text-muted-foreground" data-testid="text-pagination-info">
              Exibindo {((safePage - 1) * itemsPerPage) + 1}-{Math.min(safePage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length.toLocaleString('pt-BR')} produtos
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={safePage === 1}
                data-testid="button-prev-page"
              >
                Anterior
              </Button>
              <div className="text-sm font-medium" data-testid="text-page-number">
                Página {safePage} de {totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                data-testid="button-next-page"
              >
                Próxima
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
