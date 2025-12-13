import { Switch, Route } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserProvider, useUser } from "@/lib/user-context";
import { useWebSocket } from "@/hooks/use-websocket";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard-optimized";
import Clientes from "@/pages/clientes";
import Vendas from "@/pages/vendas";
import Produtos from "@/pages/produtos";
import ContasPagar from "@/pages/contas-pagar";
import ContasReceber from "@/pages/contas-receber";
import Metas from "@/pages/metas";
import MetasCaixa from "@/pages/metas-caixa";
import PagamentoBonus from "@/pages/pagamento-bonus";
import Calendario from "@/pages/calendario";
import Avisos from "@/pages/avisos";
import Chat from "@/pages/chat";
import Anonimo from "@/pages/anonimo";
import Usuarios from "@/pages/usuarios";
import Perfil from "@/pages/perfil";
import ReceitaDiaria from "@/pages/receita-diaria";
import MetasPessoais from "@/pages/metas-pessoais";
import AdminSync from "@/pages/admin-sync";
import NotFound from "@/pages/not-found";

function AuthenticatedRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/vendas" component={Vendas} />
      <Route path="/produtos" component={Produtos} />
      <Route path="/contas-pagar" component={ContasPagar} />
      <Route path="/contas-receber" component={ContasReceber} />
      <Route path="/metas" component={Metas} />
      <Route path="/metas-caixa" component={MetasCaixa} />
      <Route path="/pagamento-bonus" component={PagamentoBonus} />
      <Route path="/calendario" component={Calendario} />
      <Route path="/avisos" component={Avisos} />
      <Route path="/chat" component={Chat} />
      <Route path="/anonimo" component={Anonimo} />
      <Route path="/usuarios" component={Usuarios} />
      <Route path="/perfil" component={Perfil} />
      <Route path="/financeiro/receita-diaria" component={ReceitaDiaria} />
      <Route path="/metas-pessoais" component={MetasPessoais} />
      <Route path="/admin/sincronizacao" component={AdminSync} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PublicRouter() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route component={Login} />
    </Switch>
  );
}

function GlobalWebSocketHandler() {
  const { user } = useUser();
  
  useWebSocket({
    userId: user?.id,
    onMessage: (data) => {
      if (data.type === "chat" && data.data) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/messages", data.data.senderId, data.data.receiverId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/messages", data.data.receiverId, data.data.senderId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/unread-count", data.data.senderId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/unread-count", data.data.receiverId] 
        });
      }
    },
  });

  return null;
}

function AppContent() {
  const { user, isLoading } = useUser();
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <PublicRouter />;
  }

  return (
    <>
      <GlobalWebSocketHandler />
      <SidebarProvider style={sidebarStyle as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1 overflow-hidden">
            <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background">
              <div className="flex items-center gap-4">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
              </div>
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto p-6 bg-background">
              <AuthenticatedRouter />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <AppContent />
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
