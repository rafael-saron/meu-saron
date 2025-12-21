import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, RefreshCw, CheckCircle2, AlertTriangle, Search, History, Calendar, CalendarDays } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/user-context";

interface Discrepancy {
  date: string;
  store: string;
  localCount: number;
  localTotal: number;
  dapicCount: number;
  dapicTotal: number;
  countDiff: number;
  totalDiff: number;
}

interface CheckResponse {
  daysChecked: number;
  totalDiscrepancies: number;
  discrepancies: Discrepancy[];
  checkedAt: string;
}

interface ResyncResult {
  date: string;
  store: string;
  success: boolean;
  salesCount: number;
  error?: string;
}

interface ResyncResponse {
  success: boolean;
  totalSynced: number;
  results: ResyncResult[];
  message: string;
}

export default function AdminSync() {
  const { toast } = useToast();
  const { user } = useUser();
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [historicalYear, setHistoricalYear] = useState<string>("2023");
  const [historicalStore, setHistoricalStore] = useState<string>("todas");

  const { data: checkData, isFetching: isChecking, error: checkError, refetch: checkDiscrepancies } = useQuery<CheckResponse>({
    queryKey: ['/api/sales/sync/check'],
    enabled: false,
    retry: false,
  });

  const resyncMutation = useMutation({
    mutationFn: async (dates: string[]) => {
      const response = await apiRequest('POST', '/api/sales/sync/resync', { dates });
      return await response.json() as ResyncResponse;
    },
    onSuccess: (data) => {
      toast({
        title: "Resincronização concluída",
        description: data.message,
      });
      setSelectedDates(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/sales/sync/check'] });
      checkDiscrepancies();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na resincronização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const historicalSyncMutation = useMutation({
    mutationFn: async ({ year, storeId }: { year: string; storeId: string }) => {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const response = await apiRequest('POST', '/api/sales/sync', { 
        storeId: storeId === 'todas' ? undefined : storeId,
        startDate,
        endDate,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronização histórica concluída",
        description: `${data.totalSales || 0} vendas sincronizadas`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na sincronização histórica",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const quickSyncMutation = useMutation({
    mutationFn: async (type: 'today' | 'month') => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      
      let startDate: string;
      let endDate: string;
      
      if (type === 'today') {
        startDate = `${year}-${month}-${day}`;
        endDate = startDate;
      } else {
        startDate = `${year}-${month}-01`;
        const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
        endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      }
      
      const response = await apiRequest('POST', '/api/sales/sync', { 
        startDate,
        endDate,
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronização concluída",
        description: `${data.totalSales || 0} vendas sincronizadas`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/sales/summary'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro na sincronização",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleHistoricalSync = () => {
    if (!user) return;
    historicalSyncMutation.mutate({ year: historicalYear, storeId: historicalStore });
  };

  const handleCheck = async () => {
    try {
      await checkDiscrepancies();
    } catch (error: any) {
      toast({
        title: "Erro ao verificar",
        description: error?.message || "Não foi possível verificar as discrepâncias",
        variant: "destructive",
      });
    }
  };

  const handleResyncSelected = () => {
    if (selectedDates.size === 0) {
      toast({
        title: "Nenhuma data selecionada",
        description: "Selecione as datas que deseja resincronizar",
        variant: "destructive",
      });
      return;
    }
    resyncMutation.mutate(Array.from(selectedDates));
  };

  const handleResyncAll = () => {
    if (!checkData?.discrepancies.length) return;
    const uniqueDates = Array.from(new Set(checkData.discrepancies.map(d => d.date)));
    resyncMutation.mutate(uniqueDates);
  };

  const toggleDate = (date: string) => {
    const newSelected = new Set(selectedDates);
    if (newSelected.has(date)) {
      newSelected.delete(date);
    } else {
      newSelected.add(date);
    }
    setSelectedDates(newSelected);
  };

  const selectAllDates = () => {
    if (!checkData?.discrepancies.length) return;
    const allDates = new Set<string>(checkData.discrepancies.map(d => d.date));
    setSelectedDates(allDates);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'short', 
      day: '2-digit', 
      month: '2-digit' 
    });
  };

  const getStoreLabel = (storeId: string) => {
    const labels: Record<string, string> = {
      'saron1': 'Saron 1',
      'saron2': 'Saron 2',
      'saron3': 'Saron 3',
    };
    return labels[storeId] || storeId;
  };

  const groupedByDate = checkData?.discrepancies.reduce((acc, d) => {
    if (!acc[d.date]) acc[d.date] = [];
    acc[d.date].push(d);
    return acc;
  }, {} as Record<string, Discrepancy[]>) || {};

  return (
    <div className="p-6 space-y-6" data-testid="page-admin-sync">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verificação de Sincronização</h1>
          <p className="text-muted-foreground">
            Verifica e corrige discrepâncias entre o sistema local e o Dapic
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Sincronização Rápida
          </CardTitle>
          <CardDescription>
            Sincronize as vendas do dia atual ou do mês inteiro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 flex-wrap">
            <Button 
              onClick={() => quickSyncMutation.mutate('today')}
              disabled={quickSyncMutation.isPending}
              data-testid="button-sync-today"
            >
              {quickSyncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Calendar className="mr-2 h-4 w-4" />
              )}
              Sincronizar Hoje
            </Button>
            <Button 
              variant="outline"
              onClick={() => quickSyncMutation.mutate('month')}
              disabled={quickSyncMutation.isPending}
              data-testid="button-sync-month"
            >
              {quickSyncMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="mr-2 h-4 w-4" />
              )}
              Sincronizar Mês Atual
            </Button>
          </div>
          {quickSyncMutation.data && (
            <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  {quickSyncMutation.data.totalSales || 0} vendas sincronizadas
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Verificar Discrepâncias
          </CardTitle>
          <CardDescription>
            Compara as vendas dos últimos 10 dias entre o banco local e o Dapic
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={handleCheck} 
            disabled={isChecking}
            data-testid="button-check-sync"
          >
            {isChecking ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verificando...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Verificar Últimos 10 Dias
              </>
            )}
          </Button>

          {checkError && (
            <div className="p-4 rounded-lg border border-destructive bg-destructive/10 text-destructive">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                <span className="font-medium">Erro ao verificar discrepâncias</span>
              </div>
              <p className="text-sm mt-1">
                {(checkError as Error)?.message || "Não foi possível conectar ao servidor"}
              </p>
            </div>
          )}

          {checkData && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {checkData.totalDiscrepancies === 0 ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle2 className="mr-1 h-4 w-4" />
                    Tudo sincronizado
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <AlertTriangle className="mr-1 h-4 w-4" />
                    {checkData.totalDiscrepancies} discrepância(s) encontrada(s)
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Verificado em: {new Date(checkData.checkedAt).toLocaleString('pt-BR')}
                </span>
              </div>

              {checkData.totalDiscrepancies > 0 && (
                <>
                  <div className="flex gap-2 flex-wrap">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={selectAllDates}
                      data-testid="button-select-all"
                    >
                      Selecionar Todas
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setSelectedDates(new Set())}
                      data-testid="button-clear-selection"
                    >
                      Limpar Seleção
                    </Button>
                    <Button 
                      size="sm"
                      onClick={handleResyncSelected}
                      disabled={selectedDates.size === 0 || resyncMutation.isPending}
                      data-testid="button-resync-selected"
                    >
                      {resyncMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Resincronizar Selecionadas ({selectedDates.size})
                    </Button>
                    <Button 
                      variant="destructive"
                      size="sm"
                      onClick={handleResyncAll}
                      disabled={resyncMutation.isPending}
                      data-testid="button-resync-all"
                    >
                      {resyncMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Resincronizar Todas
                    </Button>
                  </div>

                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-3 text-left">Selecionar</th>
                          <th className="p-3 text-left">Data</th>
                          <th className="p-3 text-left">Loja</th>
                          <th className="p-3 text-right">Local</th>
                          <th className="p-3 text-right">Dapic</th>
                          <th className="p-3 text-right">Diferença</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(groupedByDate).map(([date, discrepancies]) => (
                          discrepancies.map((d, idx) => (
                            <tr 
                              key={`${d.date}-${d.store}`} 
                              className={`border-t ${selectedDates.has(d.date) ? 'bg-primary/5' : ''}`}
                            >
                              <td className="p-3">
                                {idx === 0 && (
                                  <input
                                    type="checkbox"
                                    checked={selectedDates.has(d.date)}
                                    onChange={() => toggleDate(d.date)}
                                    className="h-4 w-4 rounded border-gray-300"
                                    data-testid={`checkbox-date-${d.date}`}
                                  />
                                )}
                              </td>
                              <td className="p-3">
                                {idx === 0 ? formatDate(d.date) : ''}
                              </td>
                              <td className="p-3">{getStoreLabel(d.store)}</td>
                              <td className="p-3 text-right font-mono">{d.localCount}</td>
                              <td className="p-3 text-right font-mono">{d.dapicCount}</td>
                              <td className="p-3 text-right">
                                <Badge variant={d.countDiff > 0 ? "destructive" : "secondary"}>
                                  {d.countDiff > 0 ? '+' : ''}{d.countDiff}
                                </Badge>
                              </td>
                            </tr>
                          ))
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {resyncMutation.data && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Resultado da Resincronização
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-lg font-medium">{resyncMutation.data.message}</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="p-3 text-left">Data</th>
                      <th className="p-3 text-left">Loja</th>
                      <th className="p-3 text-right">Vendas</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resyncMutation.data.results.map((r, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="p-3">{formatDate(r.date)}</td>
                        <td className="p-3">{getStoreLabel(r.store)}</td>
                        <td className="p-3 text-right font-mono">{r.salesCount}</td>
                        <td className="p-3 text-center">
                          {r.success ? (
                            <Badge variant="default" className="bg-green-500">
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              Erro
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Sincronização Histórica
          </CardTitle>
          <CardDescription>
            Sincronize vendas de anos anteriores do Dapic para o sistema local
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end flex-wrap">
            <div className="space-y-2">
              <label className="text-sm font-medium">Ano</label>
              <Select value={historicalYear} onValueChange={setHistoricalYear}>
                <SelectTrigger className="w-[120px]" data-testid="select-historical-year">
                  <SelectValue placeholder="Ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2020">2020</SelectItem>
                  <SelectItem value="2021">2021</SelectItem>
                  <SelectItem value="2022">2022</SelectItem>
                  <SelectItem value="2023">2023</SelectItem>
                  <SelectItem value="2024">2024</SelectItem>
                  <SelectItem value="2025">2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Loja</label>
              <Select value={historicalStore} onValueChange={setHistoricalStore}>
                <SelectTrigger className="w-[150px]" data-testid="select-historical-store">
                  <SelectValue placeholder="Loja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas as Lojas</SelectItem>
                  <SelectItem value="saron1">Saron 1</SelectItem>
                  <SelectItem value="saron2">Saron 2</SelectItem>
                  <SelectItem value="saron3">Saron 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={handleHistoricalSync} 
              disabled={historicalSyncMutation.isPending || !user}
              data-testid="button-historical-sync"
            >
              {historicalSyncMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sincronizar {historicalYear}
                </>
              )}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Este processo pode demorar vários minutos dependendo da quantidade de vendas.
            A sincronização será feita em segundo plano.
          </p>
          {historicalSyncMutation.data && (
            <div className="p-4 rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  {historicalSyncMutation.data.message || `${historicalSyncMutation.data.totalSales || 0} vendas processadas`}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
