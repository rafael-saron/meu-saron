import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Wallet, 
  Users, 
  UserCheck, 
  CircleDollarSign,
  Store,
  CheckCircle2,
  XCircle,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SalesGoalBonus {
  id: string;
  name: string;
  role: string;
  storeId: string;
  storeName: string;
  targetValue: number;
  actualSales: number;
  percentage: number;
  isGoalMet: boolean;
  bonusPercentage: number;
  bonusValue: number;
  goalType: string;
  managerTeamBonus?: number;
}

interface CashierGoalBonus {
  id: string;
  name: string;
  role: string;
  storeId: string;
  storeName: string;
  paymentMethods: string[];
  targetPercentage: number;
  actualPercentage: number;
  isGoalMet: boolean;
  totalStoreSales: number;
  targetMethodSales: number;
  bonusPercentage: number;
  bonusValue: number;
}

interface StoreTotals {
  storeId: string;
  storeName: string;
  vendorTotal: number;
  managerTotal: number;
  cashierTotal: number;
  total: number;
}

interface PaymentSummary {
  period: {
    start: string;
    end: string;
    paymentDate: string;
  };
  salesGoals: SalesGoalBonus[];
  cashierGoals: CashierGoalBonus[];
  totals: {
    vendorTotal: number;
    managerTotal: number;
    cashierTotal: number;
    grandTotal: number;
  };
  byStore: StoreTotals[];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function SummaryCards({ data }: { data: PaymentSummary }) {
  const cards = [
    {
      title: "Total Vendedores",
      value: formatCurrency(data.totals.vendorTotal),
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      title: "Total Gerentes",
      value: formatCurrency(data.totals.managerTotal),
      icon: UserCheck,
      color: "text-green-600",
      bgColor: "bg-green-50 dark:bg-green-950/30",
    },
    {
      title: "Total Caixas",
      value: formatCurrency(data.totals.cashierTotal),
      icon: CircleDollarSign,
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950/30",
    },
    {
      title: "Total Geral",
      value: formatCurrency(data.totals.grandTotal),
      icon: Wallet,
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <card.icon className={`h-6 w-6 ${card.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-semibold" data-testid={`text-${card.title.toLowerCase().replace(/\s+/g, '-')}`}>
                  {card.value}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StoreBreakdown({ data }: { data: PaymentSummary }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Store className="h-5 w-5" />
          Bonificações por Loja
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Loja</TableHead>
              <TableHead className="text-right">Vendedores</TableHead>
              <TableHead className="text-right">Gerentes</TableHead>
              <TableHead className="text-right">Caixas</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.byStore.map((store) => (
              <TableRow key={store.storeId} data-testid={`row-store-${store.storeId}`}>
                <TableCell className="font-medium">{store.storeName}</TableCell>
                <TableCell className="text-right">{formatCurrency(store.vendorTotal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(store.managerTotal)}</TableCell>
                <TableCell className="text-right">{formatCurrency(store.cashierTotal)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(store.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="bg-muted/50 font-semibold">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totals.vendorTotal)}</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totals.managerTotal)}</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totals.cashierTotal)}</TableCell>
              <TableCell className="text-right">{formatCurrency(data.totals.grandTotal)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SalesGoalsTable({ goals, storeFilter }: { goals: SalesGoalBonus[]; storeFilter: string }) {
  const filteredGoals = storeFilter === "todas" 
    ? goals 
    : goals.filter(g => g.storeId === storeFilter);

  if (filteredGoals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma meta de vendas encontrada para o período
      </div>
    );
  }

  const hasManagers = filteredGoals.some(g => g.role === 'gerente');

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Colaborador</TableHead>
          <TableHead>Cargo</TableHead>
          <TableHead>Tipo Meta</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead className="text-right">Meta</TableHead>
          <TableHead className="text-right">Realizado</TableHead>
          <TableHead className="text-right">%</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">% Bônus</TableHead>
          {hasManagers && <TableHead className="text-right">Bônus Equipe</TableHead>}
          <TableHead className="text-right">Valor Bônus</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredGoals.map((goal, index) => (
          <TableRow key={`${goal.id}-${index}`} data-testid={`row-sales-goal-${goal.id}-${index}`}>
            <TableCell className="font-medium">{goal.name}</TableCell>
            <TableCell>
              <Badge variant={goal.role === 'gerente' ? 'default' : 'secondary'}>
                {goal.role === 'gerente' ? 'Gerente' : 'Vendedor'}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="text-xs">
                {goal.goalType === 'team' ? 'Conjunta' : 'Individual'}
              </Badge>
            </TableCell>
            <TableCell>{goal.storeName}</TableCell>
            <TableCell className="text-right">{formatCurrency(goal.targetValue)}</TableCell>
            <TableCell className="text-right">{formatCurrency(goal.actualSales)}</TableCell>
            <TableCell className="text-right">
              <span className={goal.percentage >= 100 ? 'text-green-600' : 'text-amber-600'}>
                {formatPercentage(goal.percentage)}
              </span>
            </TableCell>
            <TableCell className="text-center">
              {goal.isGoalMet ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mx-auto" />
              )}
            </TableCell>
            <TableCell className="text-right">{formatPercentage(goal.bonusPercentage)}</TableCell>
            {hasManagers && (
              <TableCell className="text-right">
                {goal.role === 'gerente' && goal.managerTeamBonus ? (
                  <span className="text-blue-600">{formatCurrency(goal.managerTeamBonus)}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
            )}
            <TableCell className="text-right font-semibold">
              {formatCurrency(goal.bonusValue)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function CashierGoalsTable({ goals, storeFilter }: { goals: CashierGoalBonus[]; storeFilter: string }) {
  const filteredGoals = storeFilter === "todas" 
    ? goals 
    : goals.filter(g => g.storeId === storeFilter);

  if (filteredGoals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhuma meta de caixa encontrada para o período
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Caixa</TableHead>
          <TableHead>Loja</TableHead>
          <TableHead>Meios de Pagamento</TableHead>
          <TableHead className="text-right">Meta %</TableHead>
          <TableHead className="text-right">Realizado %</TableHead>
          <TableHead className="text-center">Status</TableHead>
          <TableHead className="text-right">Vendas Alvo</TableHead>
          <TableHead className="text-right">% Bônus</TableHead>
          <TableHead className="text-right">Valor Bônus</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredGoals.map((goal, index) => (
          <TableRow key={`${goal.id}-${index}`} data-testid={`row-cashier-goal-${goal.id}-${index}`}>
            <TableCell className="font-medium">{goal.name}</TableCell>
            <TableCell>{goal.storeName}</TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {goal.paymentMethods.map((method) => (
                  <Badge key={method} variant="outline" className="text-xs">
                    {method}
                  </Badge>
                ))}
              </div>
            </TableCell>
            <TableCell className="text-right">{formatPercentage(goal.targetPercentage)}</TableCell>
            <TableCell className="text-right">
              <span className={goal.actualPercentage >= goal.targetPercentage ? 'text-green-600' : 'text-amber-600'}>
                {formatPercentage(goal.actualPercentage)}
              </span>
            </TableCell>
            <TableCell className="text-center">
              {goal.isGoalMet ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500 mx-auto" />
              )}
            </TableCell>
            <TableCell className="text-right">{formatCurrency(goal.targetMethodSales)}</TableCell>
            <TableCell className="text-right">{formatPercentage(goal.bonusPercentage)}</TableCell>
            <TableCell className="text-right font-semibold">
              {formatCurrency(goal.bonusValue)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default function PagamentoBonus() {
  const [storeFilter, setStoreFilter] = useState<string>("todas");

  const { data, isLoading, error } = useQuery<PaymentSummary>({
    queryKey: ["/api/bonus/payment-summary", storeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (storeFilter !== "todas") {
        params.set("storeId", storeFilter);
      }
      const response = await fetch(`/api/bonus/payment-summary?${params}`);
      if (!response.ok) {
        throw new Error("Erro ao buscar resumo de pagamento");
      }
      return response.json();
    },
    refetchInterval: 60000,
  });

  const formatPeriod = (start: string, end: string) => {
    try {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      return `${format(startDate, "dd/MM", { locale: ptBR })} - ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`;
    } catch {
      return `${start} - ${end}`;
    }
  };

  const formatPaymentDate = (date: string) => {
    try {
      return format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR });
    } catch {
      return date;
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Wallet className="h-8 w-8 text-primary" />
            Pagamento de Bonificações
          </h1>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-red-500">
              Erro ao carregar dados. Verifique suas permissões.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Wallet className="h-8 w-8 text-primary" />
            Pagamento de Bonificações
          </h1>
          <p className="text-muted-foreground mt-1">
            Resumo das bonificações a serem pagas na segunda-feira
          </p>
        </div>

        <div className="w-full sm:w-48">
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger data-testid="select-store-filter">
              <SelectValue placeholder="Filtrar por loja" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as Lojas</SelectItem>
              <SelectItem value="saron1">Saron 1</SelectItem>
              <SelectItem value="saron2">Saron 2</SelectItem>
              <SelectItem value="saron3">Saron 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {data && (
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Período de Trabalho</p>
                  <p className="font-medium" data-testid="text-period">
                    {formatPeriod(data.period.start, data.period.end)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-xs text-muted-foreground">Data de Pagamento</p>
                  <p className="font-medium capitalize" data-testid="text-payment-date">
                    {formatPaymentDate(data.period.paymentDate)}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <LoadingSkeleton />
      ) : data ? (
        <>
          <SummaryCards data={data} />
          
          <StoreBreakdown data={data} />

          <Card>
            <CardHeader>
              <CardTitle>Detalhamento Individual</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="sales" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="sales" data-testid="tab-sales-goals">
                    Vendedores e Gerentes ({data.salesGoals.length})
                  </TabsTrigger>
                  <TabsTrigger value="cashiers" data-testid="tab-cashier-goals">
                    Caixas ({data.cashierGoals.length})
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="sales">
                  <SalesGoalsTable goals={data.salesGoals} storeFilter={storeFilter} />
                </TabsContent>
                
                <TabsContent value="cashiers">
                  <CashierGoalsTable goals={data.cashierGoals} storeFilter={storeFilter} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}
