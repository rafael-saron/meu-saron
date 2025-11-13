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
import { StoreSelector } from "@/components/store-selector";
import { UserProvider } from "@/lib/user-context";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes";
import Vendas from "@/pages/vendas";
import Produtos from "@/pages/produtos";
import ContasPagar from "@/pages/contas-pagar";
import Calendario from "@/pages/calendario";
import Avisos from "@/pages/avisos";
import Chat from "@/pages/chat";
import Anonimo from "@/pages/anonimo";
import Usuarios from "@/pages/usuarios";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/vendas" component={Vendas} />
      <Route path="/produtos" component={Produtos} />
      <Route path="/contas-pagar" component={ContasPagar} />
      <Route path="/calendario" component={Calendario} />
      <Route path="/avisos" component={Avisos} />
      <Route path="/chat" component={Chat} />
      <Route path="/anonimo" component={Anonimo} />
      <Route path="/usuarios" component={Usuarios} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [selectedStore, setSelectedStore] = useState("all");

  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <ThemeProvider defaultTheme="light">
          <TooltipProvider>
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <header className="flex items-center justify-between gap-4 p-4 border-b border-border bg-background">
                    <div className="flex items-center gap-4">
                      <SidebarTrigger data-testid="button-sidebar-toggle" />
                      <StoreSelector value={selectedStore} onChange={setSelectedStore} />
                    </div>
                    <ThemeToggle />
                  </header>
                  <main className="flex-1 overflow-auto p-6 bg-background">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}

export default App;
