import { useState, useEffect } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { SalesGoal, User } from "@shared/schema";

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
  const [selectedGoal, setSelectedGoal] = useState<SalesGoal | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>("all");

  const { data: goals = [], isLoading } = useQuery<SalesGoal[]>({
    queryKey: ["/api/goals?isActive=true"],
  });

  const { data: users = [] } = useQuery<User[]>({
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
    onError: () => {
      toast({ title: "Erro ao criar meta", variant: "destructive" });
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

  const filteredGoals = storeFilter === "all" 
    ? goals 
    : goals.filter(g => g.storeId === storeFilter);

  const getWeekLabel = (weekStart: string, weekEnd: string) => {
    const start = new Date(weekStart + 'T00:00:00');
    const end = new Date(weekEnd + 'T00:00:00');
    return `${format(start, 'dd/MM', { locale: ptBR })} - ${format(end, 'dd/MM/yyyy', { locale: ptBR })}`;
  };

  const getStoreLabel = (storeId: string) => {
    const storeLabels: Record<string, string> = {
      saron1: "Saron 1",
      saron2: "Saron 2",
      saron3: "Saron 3",
    };
    return storeLabels[storeId] || storeId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Target className="h-8 w-8 text-primary" />
            Gestão de Metas
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure e acompanhe as metas de vendas semanais
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
                Configure uma meta semanal para loja ou vendedor
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

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger data-testid="select-store-filter">
              <SelectValue placeholder="Filtrar por loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as Lojas</SelectItem>
              <SelectItem value="saron1">Saron 1</SelectItem>
              <SelectItem value="saron2">Saron 2</SelectItem>
              <SelectItem value="saron3">Saron 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredGoals.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-4">Progresso das Metas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGoals.map((goal) => (
              <GoalProgressCard
                key={goal.id}
                goal={goal}
                users={users}
                getStoreLabel={getStoreLabel}
                getWeekLabel={getWeekLabel}
              />
            ))}
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Metas Ativas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando metas...
            </div>
          ) : filteredGoals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma meta encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loja</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Meta</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGoals.map((goal) => {
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
                      <TableCell className="text-muted-foreground">
                        {getWeekLabel(goal.weekStart, goal.weekEnd)}
                      </TableCell>
                      <TableCell className="font-semibold text-primary">
                        R$ {parseFloat(goal.targetValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            data-testid={`button-delete-goal-${goal.id}`}
                            onClick={() => {
                              if (confirm("Deseja realmente excluir esta meta?")) {
                                deleteMutation.mutate(goal.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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

function GoalForm({ 
  users, 
  onSubmit, 
  isLoading 
}: { 
  users: User[]; 
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
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  
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
      <div>
        <Label>Tipo de Meta</Label>
        <Select value={type} onValueChange={(value: any) => setType(value)}>
          <SelectTrigger data-testid="select-goal-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">Conjunta (Loja)</SelectItem>
            <SelectItem value="individual">Individual (Vendedor)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Período</Label>
        <Select value={period} onValueChange={(value: any) => setPeriod(value)}>
          <SelectTrigger data-testid="select-goal-period">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="weekly">Semanal</SelectItem>
            <SelectItem value="monthly">Mensal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Loja</Label>
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
          <Label>Colaborador</Label>
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Início {period === "weekly" ? "da Semana" : "do Mês"}</Label>
          <Input
            type="date"
            value={weekStartDate}
            onChange={(e) => setWeekStartDate(e.target.value)}
            required
            data-testid="input-week-start"
          />
        </div>
        <div>
          <Label>Fim {period === "weekly" ? "da Semana" : "do Mês"}</Label>
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
        <Label>Valor da Meta (R$)</Label>
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

      <div className="flex justify-end gap-2 pt-4">
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
  getWeekLabel 
}: { 
  goal: SalesGoal; 
  users: User[]; 
  getStoreLabel: (storeId: string) => string; 
  getWeekLabel: (weekStart: string, weekEnd: string) => string;
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

  return (
    <Card data-testid={`card-progress-${goal.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              {getStoreLabel(goal.storeId)}
              <Badge variant={goal.type === "individual" ? "default" : "secondary"} className="text-xs">
                {goal.type === "individual" ? "Individual" : "Conjunta"}
              </Badge>
            </CardTitle>
            {seller && (
              <p className="text-sm text-muted-foreground mt-1">{seller.fullName}</p>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {getWeekLabel(goal.weekStart, goal.weekEnd)}
            </p>
          </div>
          {!isLoading && getProgressIcon()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Carregando progresso...
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">Progresso</span>
                <span className={`text-sm font-bold ${getProgressColor()}`}>
                  {percentage.toFixed(1)}%
                </span>
              </div>
              <Progress value={cappedPercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Realizado</p>
                <p className="text-sm font-semibold text-foreground">
                  R$ {(progress?.currentValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div className="space-y-1">
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
