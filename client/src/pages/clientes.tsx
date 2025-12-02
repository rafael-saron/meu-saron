import { useState, useMemo, useEffect } from "react";
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDapicClientes } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type SortOrder = 'asc' | 'desc' | null;

export default function Clientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const { data, isLoading, error } = useDapicClientes("todas");
  
  const clientsList = data?.stores
    ? Object.values(data.stores).flatMap((storeData: any) => storeData?.Resultado || storeData?.Dados || [])
    : (data?.Resultado || []);

  const filteredClients = useMemo(() => {
    const normalizeDigits = (str: string) => str.replace(/\D/g, '');
    const searchDigits = normalizeDigits(searchTerm);
    
    let filtered = clientsList.filter((client: any) => {
      const nome = client.NomeRazaoSocial || client.Nome || '';
      const fantasia = client.Fantasia || client.NomeFantasia || '';
      const email = client.Email || '';
      const cpfCnpj = client.CpfCnpj || client.CPF || client.CNPJ || '';
      const celular = client.Celular || '';
      
      const cpfCnpjDigits = normalizeDigits(cpfCnpj);
      const celularDigits = normalizeDigits(celular);
      
      return nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        fantasia.toLowerCase().includes(searchTerm.toLowerCase()) ||
        email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (searchDigits && cpfCnpjDigits.includes(searchDigits)) ||
        (searchDigits && celularDigits.includes(searchDigits));
    });

    if (sortOrder) {
      filtered = [...filtered].sort((a, b) => {
        const nameA = (a.NomeRazaoSocial || a.Nome || a.Fantasia || '').toLowerCase();
        const nameB = (b.NomeRazaoSocial || b.Nome || b.Fantasia || '').toLowerCase();
        return sortOrder === 'asc' 
          ? nameA.localeCompare(nameB, 'pt-BR')
          : nameB.localeCompare(nameA, 'pt-BR');
      });
    }

    return filtered;
  }, [clientsList, searchTerm, sortOrder]);

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage) || 1;
  
  useEffect(() => {
    if (currentPage > totalPages && filteredClients.length > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages, filteredClients.length]);

  const safePage = Math.min(currentPage, totalPages);
  const paginatedClients = filteredClients.slice(
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
            Clientes
          </h1>
          <p className="text-muted-foreground mt-1">Base unificada de clientes ({clientsList.length.toLocaleString('pt-BR')} registros)</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Erro ao carregar clientes. Por favor, tente novamente mais tarde.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou documento..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-10"
                data-testid="input-search-clients"
              />
            </div>
            <Button 
              variant="outline" 
              onClick={toggleSortOrder}
              data-testid="button-sort-name-order"
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
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cliente encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Documento</TableHead>
                  <TableHead className="text-right">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedClients.map((client: any, index: number) => {
                  const clientId = client.Id || client.Codigo || index;
                  const clientName = client.NomeRazaoSocial || client.Nome || client.Fantasia || 'Cliente Sem Nome';
                  const fantasia = client.Fantasia || client.NomeFantasia;
                  const initials = clientName.split(' ').filter((n: string) => n).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'CL';
                  const isActive = client.StatusCliente === 0 || client.DescricaoStatusCliente === 'Ativo' || client.Ativo;
                  
                  return (
                    <TableRow key={clientId} className="hover-elevate" data-testid={`row-client-${clientId}`}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-sm">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{clientName}</p>
                            {fantasia && fantasia !== clientName && (
                              <p className="text-sm text-muted-foreground">{fantasia}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {client.Email && (
                            <p className="text-sm text-muted-foreground">{client.Email}</p>
                          )}
                          {(client.Celular || client.Telefone) && (
                            <p className="text-sm text-muted-foreground">{client.Celular || client.Telefone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.CpfCnpj || client.CPF || client.CNPJ || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={isActive ? "default" : "secondary"}>
                          {isActive ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {!isLoading && filteredClients.length > itemsPerPage && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Exibindo {((safePage - 1) * itemsPerPage) + 1}-{Math.min(safePage * itemsPerPage, filteredClients.length)} de {filteredClients.length} clientes
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
        </CardContent>
      </Card>
    </div>
  );
}
