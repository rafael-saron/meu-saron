import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Target, Plus, Trash2, TrendingUp, TrendingDown, Minus, 
  Calendar, Users, User, Search, Filter, ChevronDown, ChevronUp,
  CalendarDays, CalendarRange
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SalesGoal, User as UserType } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface GoalProgress {
  goalId: string | null;
  storeId: string;
  weekStart: string;
  weekEnd: string;
  targetValue: number | null;
  currentValue: number;
  percentage: number | null;
}

export default function Metas() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("current");
  
  // Filters
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data: goals = [], isLoading } = useQuery<SalesGoal[]>({
    queryKey: ["/api/goals?isActive=true"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/goals", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["/api/goals?isActive=true"]
      });
      toast({ title: "Meta criada com sucesso" });
      setIsCreateDialogOpen(false);
    },
    onError: async (error: any) => {
      let errorMessage = "Erro ao criar meta";
      try {
        const response = error.response || error;
        if (response?.json) {
          const data = await response.json();
          errorMessage = data.error || errorMessage;
        } else if (error.message) {
          errorMessage = error.message;
        }
      } catch (e) {
        console.error("Error parsing error response:", e);
      }
      toast({ title: errorMessage, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/goals/${id}`);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["/api/goals?isActive=true"]
      });
      toast({ title: "Meta excluída com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir meta", variant: "destructive" });
    },
  });

  // Filter and group goals
  const { weeklyGoals, monthlyGoals, currentPeriodGoals, pastGoals } = useMemo(() => {
    const today = new Date();
    
    let filtered = goals.filter(goal => {
      if (storeFilter !== "all" && goal.storeId !== storeFilter) return false;
      if (periodFilter !== "all" && goal.period !== periodFilter) return false;
      if (typeFilter !== "all" && goal.type !== typeFilter) return false;
      if (searchTerm) {
        const seller = goal.sellerId ? users.find(u => u.id === goal.sellerId) : null;
        const sellerName = seller?.fullName?.toLowerCase() || "";
        const storeName = getStoreLabel(goal.storeId).toLowerCase();
        if (!sellerName.includes(searchTerm.toLowerCase()) && 
            !storeName.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }
      return true;
    });

    const weekly = filtered.filter(g => g.period === "weekly");
    const monthly = filtered.filter(g => g.period === "monthly");
    
    const current = filtered.filter(goal => {
      // Only show weekly goals in "Em Andamento"
      if (goal.period !== "weekly") return false;
      const start = parseISO(goal.weekStart);
      const end = parseISO(goal.weekEnd);
      return isWithinInterval(today, { start, end });
    });

    const past = filtered.filter(goal => {
      const end = parseISO(goal.weekEnd);
      return end < today;
    });

    return {
      weeklyGoals: weekly,
      monthlyGoals: monthly,
      currentPeriodGoals: current,
      pastGoals: past,
    };
  }, [goals, storeFilter, periodFilter, typeFilter, searchTerm, users]);

  const getStoreLabel = (storeId: string) => {
    const storeLabels: Record<string, string> = {
      saron1: "Saron 1",
      saron2: "Saron 2",
      saron3: "Saron 3",
    };
    return storeLabels[storeId] || storeId;
  };

  const getWeekLabel = (weekStart: string, weekEnd: string) => {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(weekEnd + 'T00:00:00');
    return `${format(start, 'dd/MM', { locale: ptBR })} - ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const clearFilters = () => {
    setStoreFilter("all");
    setPeriodFilter("all");
    setTypeFilter("all");
    setSearchTerm("");
  };

  const hasActiveFilters = storeFilter !== "all" || periodFilter !== "all" || typeFilter !== "all" || searchTerm !== "";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Target className="h-7 w-7 text-primary" />
            Gestão de Metas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure e acompanhe metas de vendas
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-goal">
              <Plus className="mr-2 h-4 w-4" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Nova Meta</DialogTitle>
              <DialogDescription>
                Configure uma meta para loja ou vendedor
              </DialogDescription>
            </DialogHeader>
            <GoalForm
              users={users}
              onSubmit={(data) => createMutation.mutate(data)}
              isLoading={createMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Filtros</CardTitle>
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="text-xs">
                      {[storeFilter !== "all", periodFilter !== "all", typeFilter !== "all", searchTerm !== ""].filter(Boolean).length} ativos
                    </Badge>
                  )}
                </div>
                {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <div className="lg:col-span-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">Buscar</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Loja ou vendedor..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8"
                      data-testid="input-search"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Loja</Label>
                  <Select value={storeFilter} onValueChange={setStoreFilter}>
                    <SelectTrigger data-testid="select-store-filter">
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Lojas</SelectItem>
                      <SelectItem value="saron1">Saron 1</SelectItem>
                      <SelectItem value="saron2">Saron 2</SelectItem>
                      <SelectItem value="saron3">Saron 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Período</Label>
                  <Select value={periodFilter} onValueChange={setPeriodFilter}>
                    <SelectTrigger data-testid="select-period-filter">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="weekly">Semanal</SelectItem>
                      <SelectItem value="monthly">Mensal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger data-testid="select-type-filter">
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="individual">Individual</SelectItem>
                      <SelectItem value="team">Conjunta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button 
                    variant="outline" 
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="w-full"
                    data-testid="button-clear-filters"
                  >
                    Limpar
                  </Button>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="current" className="gap-1.5" data-testid="tab-current">
            <Target className="h-4 w-4" />
            <span className="hidden sm:inline">Em Andamento</span>
            <span className="sm:hidden">Atual</span>
            {currentPeriodGoals.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {currentPeriodGoals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="weekly" className="gap-1.5" data-testid="tab-weekly">
            <CalendarDays className="h-4 w-4" />
            <span className="hidden sm:inline">Semanais</span>
            <span className="sm:hidden">Sem.</span>
            {weeklyGoals.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {weeklyGoals.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5" data-testid="tab-monthly">
            <CalendarRange className="h-4 w-4" />
            <span className="hidden sm:inline">Mensais</span>
            <span className="sm:hidden">Mens.</span>
            {monthlyGoals.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                {monthlyGoals.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Current Period Goals */}
        <TabsContent value="current" className="space-y-4">
          {isLoading ? (
            <LoadingState />
          ) : currentPeriodGoals.length === 0 ? (
            <EmptyState message="Nenhuma meta em andamento no período atual" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {currentPeriodGoals.map((goal) => (
                <GoalProgressCard
                  key={goal.id}
                  goal={goal}
                  users={users}
                  getStoreLabel={getStoreLabel}
                  getWeekLabel={getWeekLabel}
                  onDelete={(id) => {
                    if (confirm("Deseja realmente excluir esta meta?")) {
                      deleteMutation.mutate(id);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Weekly Goals */}
        <TabsContent value="weekly" className="space-y-4">
          {isLoading ? (
            <LoadingState />
          ) : weeklyGoals.length === 0 ? (
            <EmptyState message="Nenhuma meta semanal encontrada" />
          ) : (
            <GoalsTable 
              goals={weeklyGoals}
              users={users}
              getStoreLabel={getStoreLabel}
              getWeekLabel={getWeekLabel}
              onDelete={(id) => {
                if (confirm("Deseja realmente excluir esta meta?")) {
                  deleteMutation.mutate(id);
                }
              }}
            />
          )}
        </TabsContent>

        {/* Monthly Goals */}
        <TabsContent value="monthly" className="space-y-4">
          {isLoading ? (
            <LoadingState />
          ) : monthlyGoals.length === 0 ? (
            <EmptyState message="Nenhuma meta mensal encontrada" />
          ) : (
            <GoalsTable 
              goals={monthlyGoals}
              users={users}
              getStoreLabel={getStoreLabel}
              getWeekLabel={getWeekLabel}
              onDelete={(id) => {
                if (confirm("Deseja realmente excluir esta meta?")) {
                  deleteMutation.mutate(id);
                }
              }}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      Carregando metas...
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center text-muted-foreground">
          <Target className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>{message}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalsTable({ 
  goals, 
  users, 
  getStoreLabel, 
  getWeekLabel,
  onDelete 
}: { 
  goals: SalesGoal[];
  users: UserType[];
  getStoreLabel: (storeId: string) => string;
  getWeekLabel: (weekStart: string, weekEnd: string) => string;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loja</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Vendedor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Meta</TableHead>
              <TableHead className="text-right w-[80px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.map((goal) => {
              const seller = goal.sellerId 
                ? users.find(u => u.id === goal.sellerId) 
                : null;
              
              return (
                <TableRow key={goal.id} data-testid={`row-goal-${goal.id}`}>
                  <TableCell className="font-medium">
                    {getStoreLabel(goal.storeId)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={goal.type === "individual" ? "default" : "secondary"}>
                      {goal.type === "individual" ? "Individual" : "Conjunta"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {seller ? seller.fullName : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {getWeekLabel(goal.weekStart, goal.weekEnd)}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    R$ {parseFloat(goal.targetValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      data-testid={`button-delete-goal-${goal.id}`}
                      onClick={() => onDelete(goal.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GoalForm({ 
  users, 
  onSubmit, 
  isLoading 
}: { 
  users: UserType[]; 
  onSubmit: (data: any) => void; 
  isLoading: boolean;
}) {
  const [type, setType] = useState<"individual" | "team">("team");
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [storeId, setStoreId] = useState("saron1");
  const [sellerId, setSellerId] = useState("");
  const [targetValue, setTargetValue] = useState("");
  
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
  
  const [weekStartDate, setWeekStartDate] = useState(format(weekStart, 'yyyy-MM-dd'));
  const [weekEndDate, setWeekEndDate] = useState(format(weekEnd, 'yyyy-MM-dd'));

  const sellers = users.filter(u => (u.role === "vendedor" || u.role === "gerente") && u.storeId === storeId);

  useEffect(() => {
    setSellerId("");
  }, [storeId]);
  
  useEffect(() => {
    const today = new Date();
    if (period === "weekly") {
      setWeekStartDate(format(startOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
      setWeekEndDate(format(endOfWeek(today, { weekStartsOn: 0 }), 'yyyy-MM-dd'));
    } else {
      setWeekStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
      setWeekEndDate(format(endOfMonth(today), 'yyyy-MM-dd'));
    }
  }, [period]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!targetValue || parseFloat(targetValue) <= 0) {
      return;
    }

    onSubmit({
      type,
      period,
      storeId,
      sellerId: type === "individual" ? sellerId : null,
      weekStart: weekStartDate,
      weekEnd: weekEndDate,
      targetValue: targetValue,
      isActive: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Tipo de Meta</Label>
          <Select value={type} onValueChange={(value: any) => setType(value)}>
            <SelectTrigger data-testid="select-goal-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="team">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Conjunta
                </div>
              </SelectItem>
              <SelectItem value="individual">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Individual
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Período</Label>
          <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
            <SelectTrigger data-testid="select-goal-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Semanal
                </div>
              </SelectItem>
              <SelectItem value="monthly">
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  Mensal
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Loja</Label>
        <Select value={storeId} onValueChange={setStoreId}>
          <SelectTrigger data-testid="select-store">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="saron1">Saron 1</SelectItem>
            <SelectItem value="saron2">Saron 2</SelectItem>
            <SelectItem value="saron3">Saron 3</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {type === "individual" && (
        <div>
          <Label className="text-xs">Colaborador</Label>
          <Select key={storeId} value={sellerId} onValueChange={setSellerId} required>
            <SelectTrigger data-testid="select-seller">
              <SelectValue placeholder="Selecione um colaborador" />
            </SelectTrigger>
            <SelectContent>
              {sellers.length === 0 ? (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  Nenhum colaborador encontrado
                </div>
              ) : (
                sellers.map((seller) => (
                  <SelectItem key={seller.id} value={seller.id}>
                    {seller.fullName} ({seller.role === "gerente" ? "Gerente" : "Vendedor"})
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Início {period === "weekly" ? "da Semana" : "do Mês"}</Label>
          <Input
            type="date"
            value={weekStartDate}
            onChange={(e) => setWeekStartDate(e.target.value)}
            required
            data-testid="input-week-start"
          />
        </div>
        <div>
          <Label className="text-xs">Fim {period === "weekly" ? "da Semana" : "do Mês"}</Label>
          <Input
            type="date"
            value={weekEndDate}
            onChange={(e) => setWeekEndDate(e.target.value)}
            required
            data-testid="input-week-end"
          />
        </div>
      </div>

      <div>
        <Label className="text-xs">Valor da Meta (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={targetValue}
          onChange={(e) => setTargetValue(e.target.value)}
          placeholder="0.00"
          required
          data-testid="input-target-value"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={isLoading} data-testid="button-submit-goal">
          {isLoading ? "Criando..." : "Criar Meta"}
        </Button>
      </div>
    </form>
  );
}

function GoalProgressCard({ 
  goal, 
  users, 
  getStoreLabel, 
  getWeekLabel,
  onDelete
}: { 
  goal: SalesGoal; 
  users: UserType[]; 
  getStoreLabel: (storeId: string) => string; 
  getWeekLabel: (weekStart: string, weekEnd: string) => string;
  onDelete: (id: string) => void;
}) {
  const { data: progress, isLoading } = useQuery<GoalProgress>({
    queryKey: [`/api/goals/progress?goalId=${goal.id}`],
    refetchInterval: 60000,
  });

  const seller = goal.sellerId ? users.find(u => u.id === goal.sellerId) : null;
  const percentage = progress?.percentage || 0;
  const cappedPercentage = Math.min(percentage, 100);

  const getProgressIcon = () => {
    if (percentage >= 100) return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (percentage >= 70) return <TrendingUp className="h-5 w-5 text-yellow-500" />;
    if (percentage >= 40) return <Minus className="h-5 w-5 text-orange-500" />;
    return <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  const getProgressColor = () => {
    if (percentage >= 100) return "text-green-600 dark:text-green-400";
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (percentage >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const periodIcon = goal.period === "monthly" ? (
    <CalendarRange className="h-3.5 w-3.5" />
  ) : (
    <CalendarDays className="h-3.5 w-3.5" />
  );

  return (
    <Card data-testid={`card-progress-${goal.id}`} className="hover-elevate">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
              {getStoreLabel(goal.storeId)}
              <Badge variant={goal.type === "individual" ? "default" : "secondary"} className="text-xs">
                {goal.type === "individual" ? "Individual" : "Conjunta"}
              </Badge>
            </CardTitle>
            {seller && (
              <p className="text-sm text-muted-foreground mt-1 truncate">{seller.fullName}</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
              {periodIcon}
              <span>{getWeekLabel(goal.weekStart, goal.weekEnd)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {!isLoading && getProgressIcon()}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onDelete(goal.id)}
              data-testid={`button-delete-card-${goal.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Carregando...
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-muted-foreground">Progresso</span>
                <span className={`text-sm font-bold ${getProgressColor()}`}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={cappedPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Realizado</p>
                <p className="text-sm font-semibold text-foreground">
                  R$ {(progress?.currentValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">Meta</p>
                <p className="text-sm font-semibold text-primary">
                  R$ {parseFloat(goal.targetValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
