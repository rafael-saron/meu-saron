import { useState, useMemo, useEffect } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useDapicClientes } from "@/hooks/use-dapic";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Clientes() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 100;

  const { data, isLoading, error } = useDapicClientes("todas");
  
  const clientsList = data?.stores
    ? Object.values(data.stores).flatMap((storeData: any) => storeData?.Resultado || storeData?.Dados || [])
    : (data?.Resultado || []);

  const filteredClients = useMemo(() => {
    return clientsList.filter((client: any) =>
      (client.Nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.Email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.NomeFantasia || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (client.CPF || '').includes(searchTerm) ||
      (client.CNPJ || '').includes(searchTerm)
    );
  }, [clientsList, searchTerm]);

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
                  const clientName = client.Nome || client.NomeFantasia || 'Cliente Sem Nome';
                  const initials = clientName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                  
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
                            {client.NomeFantasia && client.Nome !== client.NomeFantasia && (
                              <p className="text-sm text-muted-foreground">{client.NomeFantasia}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {client.Email && (
                            <p className="text-sm text-muted-foreground">{client.Email}</p>
                          )}
                          {client.Telefone && (
                            <p className="text-sm text-muted-foreground">{client.Telefone}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {client.CPF || client.CNPJ || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={client.Ativo ? "default" : "secondary"}>
                          {client.Ativo ? "Ativo" : "Inativo"}
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
