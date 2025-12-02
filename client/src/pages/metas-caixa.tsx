import { useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Plus, Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { format, startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CashierGoal, User } from "@shared/schema";

interface CashierGoalProgress {
  goalId: string;
  cashierId: string;
  storeId: string;
  periodType: string;
  weekStart: string;
  weekEnd: string;
  paymentMethods: string[];
  targetPercentage: number;
  percentageAchieved: number;
  isGoalMet: boolean;
  totalStoreSales: number;
  targetMethodSales: number;
  bonusPercentage: number;
  bonusValue: number;
}

const PAYMENT_METHODS = [
  { id: "pix", label: "PIX" },
  { id: "debito", label: "Débito" },
  { id: "dinheiro", label: "Dinheiro" },
];

export default function MetasCaixa() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<CashierGoal | null>(null);
  const [storeFilter, setStoreFilter] = useState<string>("all");

  const [formData, setFormData] = useState({
    cashierId: "",
    storeId: "saron1" as "saron1" | "saron2" | "saron3",
    periodType: "weekly" as "weekly" | "monthly",
    weekStart: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    weekEnd: format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
    paymentMethods: ["pix", "debito", "dinheiro"],
    targetPercentage: "50",
    bonusPercentageAchieved: "0.7",
    bonusPercentageNotAchieved: "0.4",
  });

  const { data: goals = [], isLoading } = useQuery<CashierGoal[]>({
    queryKey: ["/api/cashier-goals?isActive=true"],
  });

  const { data: progress = [] } = useQuery<CashierGoalProgress[]>({
    queryKey: ["/api/cashier-goals/progress"],
    refetchInterval: 60000,
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const cashierUsers = users.filter(u => u.role === "caixa" && u.isActive);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/cashier-goals", data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["/api/cashier-goals?isActive=true"]
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/cashier-goals/progress"]
      });
      toast({ title: "Meta de caixa criada com sucesso" });
      setIsCreateDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao criar meta de caixa", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PATCH", `/api/cashier-goals/${id}`, data);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["/api/cashier-goals?isActive=true"]
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/cashier-goals/progress"]
      });
      toast({ title: "Meta atualizada com sucesso" });
      setSelectedGoal(null);
      resetForm();
    },
    onError: () => {
      toast({ title: "Erro ao atualizar meta", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/cashier-goals/${id}`);
    },
    onSuccess: async () => {
      await queryClient.refetchQueries({ 
        queryKey: ["/api/cashier-goals?isActive=true"]
      });
      await queryClient.refetchQueries({ 
        queryKey: ["/api/cashier-goals/progress"]
      });
      toast({ title: "Meta excluída com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao excluir meta", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      cashierId: "",
      storeId: "saron1",
      periodType: "weekly",
      weekStart: format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      weekEnd: format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd"),
      paymentMethods: ["pix", "debito", "dinheiro"],
      targetPercentage: "50",
      bonusPercentageAchieved: "0.7",
      bonusPercentageNotAchieved: "0.4",
    });
  };

  const handlePeriodChange = (period: "weekly" | "monthly") => {
    const now = new Date();
    if (period === "weekly") {
      setFormData(prev => ({
        ...prev,
        periodType: period,
        weekStart: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        weekEnd: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        periodType: period,
        weekStart: format(startOfMonth(now), "yyyy-MM-dd"),
        weekEnd: format(endOfMonth(now), "yyyy-MM-dd"),
      }));
    }
  };

  const handlePaymentMethodToggle = (methodId: string) => {
    setFormData(prev => {
      const methods = prev.paymentMethods.includes(methodId)
        ? prev.paymentMethods.filter(m => m !== methodId)
        : [...prev.paymentMethods, methodId];
      return { ...prev, paymentMethods: methods };
    });
  };

  const handleSubmit = () => {
    if (!formData.cashierId) {
      toast({ title: "Selecione um caixa", variant: "destructive" });
      return;
    }
    if (formData.paymentMethods.length === 0) {
      toast({ title: "Selecione pelo menos um meio de pagamento", variant: "destructive" });
      return;
    }

    const submitData = {
      cashierId: formData.cashierId,
      storeId: formData.storeId,
      periodType: formData.periodType,
      weekStart: formData.weekStart,
      weekEnd: formData.weekEnd,
      paymentMethods: formData.paymentMethods,
      targetPercentage: formData.targetPercentage,
      bonusPercentageAchieved: formData.bonusPercentageAchieved,
      bonusPercentageNotAchieved: formData.bonusPercentageNotAchieved,
    };

    if (selectedGoal) {
      updateMutation.mutate({ id: selectedGoal.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleEdit = (goal: CashierGoal) => {
    setSelectedGoal(goal);
    setFormData({
      cashierId: goal.cashierId,
      storeId: goal.storeId as "saron1" | "saron2" | "saron3",
      periodType: goal.periodType as "weekly" | "monthly",
      weekStart: goal.weekStart,
      weekEnd: goal.weekEnd,
      paymentMethods: goal.paymentMethods || [],
      targetPercentage: goal.targetPercentage,
      bonusPercentageAchieved: goal.bonusPercentageAchieved,
      bonusPercentageNotAchieved: goal.bonusPercentageNotAchieved,
    });
    setIsCreateDialogOpen(true);
  };

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

  const getCashierName = (cashierId: string) => {
    const cashier = users.find(u => u.id === cashierId);
    return cashier?.fullName || "Desconhecido";
  };

  const getGoalProgress = (goalId: string) => {
    return progress.find(p => p.goalId === goalId);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Wallet className="h-8 w-8 text-primary" />
            Metas de Caixa
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure e acompanhe as metas de meios de pagamento
          </p>
        </div>
        <Button 
          onClick={() => {
            resetForm();
            setSelectedGoal(null);
            setIsCreateDialogOpen(true);
          }}
          data-testid="button-create-goal"
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova Meta
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Filtrar por loja:</Label>
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-40" data-testid="select-store-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="saron1">Saron 1</SelectItem>
              <SelectItem value="saron2">Saron 2</SelectItem>
              <SelectItem value="saron3">Saron 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

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
              Nenhuma meta cadastrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Caixa</TableHead>
                  <TableHead>Loja</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Meios de Pagamento</TableHead>
                  <TableHead>Meta %</TableHead>
                  <TableHead>Progresso</TableHead>
                  <TableHead>Bônus</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGoals.map((goal) => {
                  const goalProgress = getGoalProgress(goal.id);
                  const percentage = goalProgress?.percentageAchieved || 0;
                  const isGoalMet = goalProgress?.isGoalMet || false;
                  const bonusValue = goalProgress?.bonusValue || 0;

                  return (
                    <TableRow key={goal.id} data-testid={`row-goal-${goal.id}`}>
                      <TableCell className="font-medium">
                        {getCashierName(goal.cashierId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getStoreLabel(goal.storeId)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <Badge variant="secondary" className="mb-1">
                            {goal.periodType === "weekly" ? "Semanal" : "Mensal"}
                          </Badge>
                          <div className="text-muted-foreground text-xs">
                            {getWeekLabel(goal.weekStart, goal.weekEnd)}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {(goal.paymentMethods || []).map(method => (
                            <Badge key={method} variant="outline" className="text-xs">
                              {method.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {goal.targetPercentage}%
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Progress 
                              value={Math.min(percentage, 100)} 
                              className="w-24"
                            />
                            <span className={`text-sm font-medium ${isGoalMet ? 'text-green-600' : 'text-amber-600'}`}>
                              {percentage.toFixed(1)}%
                            </span>
                            {isGoalMet ? (
                              <TrendingUp className="h-4 w-4 text-green-600" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-amber-600" />
                            )}
                          </div>
                          {goalProgress && (
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(goalProgress.targetMethodSales)} de {formatCurrency(goalProgress.totalStoreSales)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className={`font-medium ${isGoalMet ? 'text-green-600' : 'text-amber-600'}`}>
                            {formatCurrency(bonusValue)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {isGoalMet 
                              ? `${goal.bonusPercentageAchieved}% (meta atingida)`
                              : `${goal.bonusPercentageNotAchieved}% (abaixo da meta)`
                            }
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(goal)}
                            data-testid={`button-edit-${goal.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteMutation.mutate(goal.id)}
                            data-testid={`button-delete-${goal.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
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

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedGoal ? "Editar Meta de Caixa" : "Nova Meta de Caixa"}
            </DialogTitle>
            <DialogDescription>
              Configure a meta de percentual de vendas em meios de pagamento específicos
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Caixa</Label>
                <Select 
                  value={formData.cashierId} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, cashierId: v }))}
                >
                  <SelectTrigger data-testid="select-cashier">
                    <SelectValue placeholder="Selecione o caixa" />
                  </SelectTrigger>
                  <SelectContent>
                    {cashierUsers.map(user => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Loja</Label>
                <Select 
                  value={formData.storeId} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, storeId: v as any }))}
                >
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
            </div>

            <div className="space-y-2">
              <Label>Período</Label>
              <Select 
                value={formData.periodType} 
                onValueChange={(v) => handlePeriodChange(v as "weekly" | "monthly")}
              >
                <SelectTrigger data-testid="select-period">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input
                  type="date"
                  value={formData.weekStart}
                  onChange={(e) => setFormData(prev => ({ ...prev, weekStart: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input
                  type="date"
                  value={formData.weekEnd}
                  onChange={(e) => setFormData(prev => ({ ...prev, weekEnd: e.target.value }))}
                  data-testid="input-end-date"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meios de Pagamento</Label>
              <div className="flex flex-wrap gap-4 py-2">
                {PAYMENT_METHODS.map(method => (
                  <div key={method.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`method-${method.id}`}
                      checked={formData.paymentMethods.includes(method.id)}
                      onCheckedChange={() => handlePaymentMethodToggle(method.id)}
                      data-testid={`checkbox-method-${method.id}`}
                    />
                    <label
                      htmlFor={`method-${method.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {method.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Meta de Percentual (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={formData.targetPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, targetPercentage: e.target.value }))}
                placeholder="Ex: 50 (para 50% das vendas nesses meios)"
                data-testid="input-target-percentage"
              />
              <p className="text-xs text-muted-foreground">
                Percentual mínimo das vendas totais da loja que devem ser feitas nos meios selecionados
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bônus % (Meta Atingida)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bonusPercentageAchieved}
                  onChange={(e) => setFormData(prev => ({ ...prev, bonusPercentageAchieved: e.target.value }))}
                  placeholder="Ex: 0.7"
                  data-testid="input-bonus-achieved"
                />
                <p className="text-xs text-muted-foreground">
                  % aplicado sobre vendas nos meios selecionados
                </p>
              </div>
              <div className="space-y-2">
                <Label>Bônus % (Meta Não Atingida)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.bonusPercentageNotAchieved}
                  onChange={(e) => setFormData(prev => ({ ...prev, bonusPercentageNotAchieved: e.target.value }))}
                  placeholder="Ex: 0.4"
                  data-testid="input-bonus-not-achieved"
                />
                <p className="text-xs text-muted-foreground">
                  % aplicado se meta não for atingida
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  setSelectedGoal(null);
                  resetForm();
                }}
                data-testid="button-cancel"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save"
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? "Salvando..." 
                  : selectedGoal 
                    ? "Atualizar" 
                    : "Criar Meta"
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
