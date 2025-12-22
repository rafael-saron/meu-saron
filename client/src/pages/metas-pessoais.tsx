import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useUser } from "@/lib/user-context";
import { Target, TrendingUp, TrendingDown, Minus, Award, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PersonalGoal {
  id: string;
  storeId: string;
  period: string;
  weekStart: string;
  weekEnd: string;
  targetValue: number;
  currentValue: number;
  percentage: number;
  achieved: boolean;
  isFinished: boolean;
  bonusPercentageAchieved: number;
  bonusPercentageNotAchieved: number;
  appliedBonusPercentage: number;
  bonusValue: number;
  // Cashier-specific fields
  isCashierGoal?: boolean;
  paymentMethods?: string[];
  totalStoreSales?: number;
  targetMethodSales?: number;
  // Team goal indicator
  isTeamGoal?: boolean;
}

interface PersonalGoalsResponse {
  user: {
    id: string;
    fullName: string;
    role: string;
    storeId: string;
    bonusPercentageAchieved: number;
    bonusPercentageNotAchieved: number;
  };
  goals: PersonalGoal[];
  summary: {
    totalGoals: number;
    achievedGoals: number;
    totalBonus: number;
    totalSales: number;
  };
  isCashierData?: boolean;
}

export default function MetasPessoais() {
  const { user } = useUser();

  const { data, isLoading, error } = useQuery<PersonalGoalsResponse>({
    queryKey: ["/api/goals/personal"],
    enabled: !!user && (user.role === "vendedor" || user.role === "gerente" || user.role === "caixa"),
  });

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

  const getProgressIcon = (percentage: number, isFinished: boolean, achieved: boolean) => {
    if (isFinished) {
      return achieved 
        ? <CheckCircle className="h-5 w-5 text-green-500" />
        : <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (percentage >= 100) return <TrendingUp className="h-5 w-5 text-green-500" />;
    if (percentage >= 70) return <TrendingUp className="h-5 w-5 text-yellow-500" />;
    if (percentage >= 40) return <Minus className="h-5 w-5 text-orange-500" />;
    return <TrendingDown className="h-5 w-5 text-red-500" />;
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "text-green-600 dark:text-green-400";
    if (percentage >= 70) return "text-yellow-600 dark:text-yellow-400";
    if (percentage >= 40) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  if (!user || (user.role !== "vendedor" && user.role !== "gerente" && user.role !== "caixa")) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Acesso Restrito</h2>
        <p className="text-muted-foreground">
          Esta página é exclusiva para vendedores, gerentes e caixas.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Target className="h-8 w-8 text-primary" />
            Minhas Metas
          </h1>
          <p className="text-muted-foreground mt-1">Carregando suas metas pessoais...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">Erro ao Carregar</h2>
        <p className="text-muted-foreground">
          Não foi possível carregar suas metas. Tente novamente mais tarde.
        </p>
      </div>
    );
  }

  const { goals, summary, isCashierData } = data;
  const hasTeamGoals = goals.some(g => g.isTeamGoal);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
          <Target className="h-8 w-8 text-primary" />
          Minhas Metas
        </h1>
        <p className="text-muted-foreground mt-1">
          {isCashierData 
            ? "Acompanhe suas metas de caixa e bônus das últimas 4 semanas"
            : hasTeamGoals
              ? "Acompanhe as metas da equipe e bônus das últimas 4 semanas"
              : "Acompanhe suas metas individuais e bônus das últimas 4 semanas"
          }
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-goals">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Target className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Metas</p>
                <p className="text-2xl font-bold text-foreground">{summary.totalGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-achieved-goals">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-green-500/10">
                <Award className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Metas Atingidas</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.achievedGoals}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-sales">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-blue-500/10">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isCashierData ? "Vendas nos Meios" : "Total Vendido"}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  R$ {summary.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-bonus">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-full bg-yellow-500/10">
                <DollarSign className="h-6 w-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total em Bônus</p>
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                  R$ {summary.totalBonus.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {goals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma Meta Encontrada</h3>
            <p className="text-muted-foreground">
              {user?.storeId === 'saron2' && user?.role === 'vendedor'
                ? "Ainda não há metas conjuntas cadastradas para sua loja."
                : "Você ainda não possui metas individuais atribuídas."
              }
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Weekly Goals Section */}
          {goals.filter(g => g.period === 'weekly').length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Target className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Metas Semanais</h2>
                  <p className="text-sm text-muted-foreground">Acompanhamento das metas por semana</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.filter(g => g.period === 'weekly').map((goal) => (
                  <Card key={goal.id} data-testid={`card-goal-weekly-${goal.id}`} className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                            {getStoreLabel(goal.storeId)}
                            {goal.isTeamGoal && (
                              <Badge variant="outline" className="text-xs">Conjunta</Badge>
                            )}
                            <Badge 
                              variant={goal.isFinished ? (goal.achieved ? "default" : "destructive") : "secondary"} 
                              className="text-xs"
                            >
                              {goal.isFinished 
                                ? (goal.achieved ? "Atingida" : "Não Atingida") 
                                : "Em Andamento"}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getWeekLabel(goal.weekStart, goal.weekEnd)}
                          </p>
                        </div>
                        {getProgressIcon(goal.percentage, goal.isFinished, goal.achieved)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">Progresso</span>
                          <span className={`text-sm font-bold ${getProgressColor(goal.percentage)}`}>
                            {goal.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={Math.min(goal.percentage, 100)} className="h-2" />
                      </div>
                      
                      {goal.isCashierGoal ? (
                        <>
                          {goal.paymentMethods && goal.paymentMethods.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Meios de Pagamento</p>
                              <div className="flex flex-wrap gap-1">
                                {goal.paymentMethods.map((method: string) => (
                                  <Badge key={method} variant="outline" className="text-xs">
                                    {method}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">% Alcançado</p>
                              <p className="text-sm font-semibold text-foreground">
                                {goal.currentValue.toFixed(1)}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Meta %</p>
                              <p className="text-sm font-semibold text-primary">
                                {goal.targetValue.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          {goal.targetMethodSales !== undefined && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Vendas (Meios)</p>
                                <p className="text-sm font-semibold text-foreground">
                                  R$ {goal.targetMethodSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Total Loja</p>
                                <p className="text-sm font-semibold text-muted-foreground">
                                  R$ {(goal.totalStoreSales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Realizado</p>
                            <p className="text-sm font-semibold text-foreground">
                              R$ {goal.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Meta</p>
                            <p className="text-sm font-semibold text-primary">
                              R$ {goal.targetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      )}

                      {goal.isFinished && (
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Bônus ({goal.appliedBonusPercentage}%)</p>
                              <p className={`text-sm font-bold ${goal.bonusValue > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                R$ {goal.bonusValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            {goal.achieved && (
                              <Award className="h-5 w-5 text-yellow-500" />
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Monthly Goals Section */}
          {goals.filter(g => g.period === 'monthly').length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Award className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Metas Mensais</h2>
                  <p className="text-sm text-muted-foreground">Acompanhamento das metas por mês</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.filter(g => g.period === 'monthly').map((goal) => (
                  <Card key={goal.id} data-testid={`card-goal-monthly-${goal.id}`} className="border-l-4 border-l-purple-500">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                            {getStoreLabel(goal.storeId)}
                            {goal.isTeamGoal && (
                              <Badge variant="outline" className="text-xs">Conjunta</Badge>
                            )}
                            <Badge 
                              variant={goal.isFinished ? (goal.achieved ? "default" : "destructive") : "secondary"} 
                              className="text-xs"
                            >
                              {goal.isFinished 
                                ? (goal.achieved ? "Atingida" : "Não Atingida") 
                                : "Em Andamento"}
                            </Badge>
                          </CardTitle>
                          <p className="text-xs text-muted-foreground mt-1">
                            {getWeekLabel(goal.weekStart, goal.weekEnd)}
                          </p>
                        </div>
                        {getProgressIcon(goal.percentage, goal.isFinished, goal.achieved)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-muted-foreground">Progresso</span>
                          <span className={`text-sm font-bold ${getProgressColor(goal.percentage)}`}>
                            {goal.percentage.toFixed(1)}%
                          </span>
                        </div>
                        <Progress value={Math.min(goal.percentage, 100)} className="h-2" />
                      </div>
                      
                      {goal.isCashierGoal ? (
                        <>
                          {goal.paymentMethods && goal.paymentMethods.length > 0 && (
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Meios de Pagamento</p>
                              <div className="flex flex-wrap gap-1">
                                {goal.paymentMethods.map((method: string) => (
                                  <Badge key={method} variant="outline" className="text-xs">
                                    {method}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">% Alcançado</p>
                              <p className="text-sm font-semibold text-foreground">
                                {goal.currentValue.toFixed(1)}%
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-xs text-muted-foreground">Meta %</p>
                              <p className="text-sm font-semibold text-primary">
                                {goal.targetValue.toFixed(1)}%
                              </p>
                            </div>
                          </div>
                          {goal.targetMethodSales !== undefined && (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Vendas (Meios)</p>
                                <p className="text-sm font-semibold text-foreground">
                                  R$ {goal.targetMethodSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Total Loja</p>
                                <p className="text-sm font-semibold text-muted-foreground">
                                  R$ {(goal.totalStoreSales || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Realizado</p>
                            <p className="text-sm font-semibold text-foreground">
                              R$ {goal.currentValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Meta</p>
                            <p className="text-sm font-semibold text-primary">
                              R$ {goal.targetValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        </div>
                      )}

                      {goal.isFinished && (
                        <div className="pt-2 border-t border-border">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground">Bônus ({goal.appliedBonusPercentage}%)</p>
                              <p className={`text-sm font-bold ${goal.bonusValue > 0 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                R$ {goal.bonusValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            {goal.achieved && (
                              <Award className="h-5 w-5 text-yellow-500" />
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
