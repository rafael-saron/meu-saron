import { Home, Users, ShoppingBag, Package, DollarSign, Calendar, Bell, MessageCircle, Send, LayoutDashboard, UserCog, LogOut, Target, Wallet, Banknote, TrendingUp, BarChart3, Award, RefreshCw } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@/lib/user-context";
import { useUnreadCount } from "@/hooks/use-unread-count";
import logoUrl from "@assets/Logo Saron_1763050286995.png";

const allMenuItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, roles: ["administrador", "gerente", "vendedor", "financeiro", "caixa"] },
  { title: "Clientes", url: "/clientes", icon: Users, roles: ["administrador", "gerente"] },
  { title: "Vendas", url: "/vendas", icon: ShoppingBag, roles: ["administrador", "gerente"] },
  { title: "Produtos", url: "/produtos", icon: Package, roles: ["administrador", "gerente"] },
  { title: "Contas a Pagar", url: "/contas-pagar", icon: DollarSign, roles: ["administrador", "financeiro"] },
  { title: "Contas a Receber", url: "/contas-receber", icon: TrendingUp, roles: ["administrador", "financeiro"] },
  { title: "Metas", url: "/metas", icon: Target, roles: ["administrador", "gerente"] },
  { title: "Metas de Caixa", url: "/metas-caixa", icon: Wallet, roles: ["administrador", "gerente"] },
  { title: "Minhas Metas", url: "/metas-pessoais", icon: Award, roles: ["vendedor", "gerente", "caixa"] },
  { title: "Pagamento Bônus", url: "/pagamento-bonus", icon: Banknote, roles: ["administrador", "financeiro"] },
];

const communicationItems = [
  { title: "Calendário", url: "/calendario", icon: Calendar },
  { title: "Avisos", url: "/avisos", icon: Bell },
  { title: "Chat", url: "/chat", icon: MessageCircle },
  { title: "Mensagem Anônima", url: "/anonimo", icon: Send },
];

const financialItems = [
  { title: "Receita Diária", url: "/financeiro/receita-diaria", icon: BarChart3 },
];

const adminItems = [
  { title: "Usuários", url: "/usuarios", icon: UserCog },
  { title: "Sincronização", url: "/admin/sincronizacao", icon: RefreshCw },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useUser();
  const { data: unreadData } = useUnreadCount(user?.id);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const roleLabels: Record<string, string> = {
    administrador: "Administrador",
    gerente: "Gerente",
    vendedor: "Vendedor",
    financeiro: "Financeiro",
    caixa: "Caixa",
  };

  const userRole = user?.role || "vendedor";
  const mainMenuItems = allMenuItems.filter(item => item.roles.includes(userRole));

  return (
    <Sidebar>
      <SidebarHeader className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img src={logoUrl} alt="Saron" className="h-16 w-auto dark:invert dark:brightness-0 dark:contrast-200" />
        </div>
      </SidebarHeader>

      <SidebarContent className="px-4 py-6">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Gestão
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainMenuItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className="data-[active=true]:bg-sidebar-accent"
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-6">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Comunicação
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {communicationItems.map((item) => {
                const isActive = location === item.url;
                const showBadge = item.url === "/chat" && unreadData && unreadData.count > 0;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      data-active={isActive}
                      className="data-[active=true]:bg-sidebar-accent"
                      data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                        {showBadge && (
                          <Badge 
                            variant="default" 
                            className="ml-auto h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-xs font-medium"
                            data-testid="badge-unread-count"
                          >
                            {unreadData.count}
                          </Badge>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {(user?.role === "administrador" || user?.role === "financeiro") && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Financeiro
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {financialItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        data-active={isActive}
                        className="data-[active=true]:bg-sidebar-accent"
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {user?.role === "administrador" && (
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Administração
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        data-active={isActive}
                        className="data-[active=true]:bg-sidebar-accent"
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        <Link href={item.url}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Link href="/perfil" className="flex items-center gap-3 mb-3 hover-elevate rounded-md p-2 -m-2 cursor-pointer" data-testid="link-perfil">
          <Avatar className="h-9 w-9">
            <AvatarImage src={user?.avatar || ""} alt={user?.fullName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
              {user ? getInitials(user.fullName) : "US"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{user?.fullName || "Usuário"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user ? roleLabels[user.role as keyof typeof roleLabels] : "Vendedor"}
            </p>
          </div>
        </Link>
        <Button 
          variant="outline" 
          className="w-full justify-start gap-2"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          <span>Sair</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
