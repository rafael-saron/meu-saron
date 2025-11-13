import { Users, ShoppingBag, Package, DollarSign } from "lucide-react";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

const salesData = [
  { month: "Jan", value: 45000 },
  { month: "Fev", value: 52000 },
  { month: "Mar", value: 48000 },
  { month: "Abr", value: 61000 },
  { month: "Mai", value: 55000 },
  { month: "Jun", value: 67000 },
];

const topProducts = [
  { name: "Calça Jeans Slim", sales: 234 },
  { name: "Camiseta Básica", sales: 189 },
  { name: "Vestido Floral", sales: 156 },
  { name: "Jaqueta Couro", sales: 142 },
  { name: "Camisa Social", sales: 128 },
];

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-dashboard-title">
          Dashboard
        </h1>
        <p className="text-muted-foreground mt-1">Visão geral do desempenho da Saron</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Clientes"
          value="2,847"
          icon={Users}
          trend={{ value: 12.5, isPositive: true }}
          description="vs. mês anterior"
        />
        <StatCard
          title="Vendas do Mês"
          value="R$ 67.340"
          icon={ShoppingBag}
          trend={{ value: 8.3, isPositive: true }}
          description="vs. mês anterior"
        />
        <StatCard
          title="Produtos"
          value="1,234"
          icon={Package}
          trend={{ value: 3.2, isPositive: false }}
          description="em estoque"
        />
        <StatCard
          title="Contas a Pagar"
          value="R$ 23.450"
          icon={DollarSign}
          description="vencendo esta semana"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card data-testid="card-sales-chart">
          <CardHeader>
            <CardTitle className="text-lg font-display">Vendas Mensais</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="month"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`R$ ${value.toLocaleString()}`, "Vendas"]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card data-testid="card-top-products">
          <CardHeader>
            <CardTitle className="text-lg font-display">Produtos Mais Vendidos</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis
                  dataKey="name"
                  type="category"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                  width={100}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                  }}
                  formatter={(value: number) => [`${value} vendas`, "Quantidade"]}
                />
                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-recent-activity">
        <CardHeader>
          <CardTitle className="text-lg font-display">Atividades Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { action: "Nova venda realizada", detail: "Pedido #1847 - R$ 450,00", time: "Há 5 minutos" },
              { action: "Cliente cadastrado", detail: "Maria Silva - mariasilva@email.com", time: "Há 23 minutos" },
              { action: "Produto adicionado", detail: "Calça Jeans Skinny - Tam. 38", time: "Há 1 hora" },
              { action: "Conta paga", detail: "Fornecedor ABC - R$ 3.450,00", time: "Há 2 horas" },
            ].map((activity, index) => (
              <div key={index} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">{activity.action}</p>
                  <p className="text-sm text-muted-foreground">{activity.detail}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
