import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, DollarSign, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContasPagar() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Contas a Pagar
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie seus pagamentos</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Contas a Pagar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div className="rounded-full bg-amber-100 dark:bg-amber-900/30 p-4">
              <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Recurso não disponível via API</h3>
              <p className="text-muted-foreground max-w-md">
                A API do Dapic não possui um endpoint para consulta de Contas a Pagar. 
                Para acessar esse recurso, utilize o sistema Dapic diretamente.
              </p>
            </div>
            <Button variant="outline" className="mt-4" asChild>
              <a href="https://dapic.webpic.com.br" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Acessar Dapic
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
