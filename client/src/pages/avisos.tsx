import { useState } from "react";
import { Bell, Pin, Plus, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const mockAnnouncements = [
  {
    id: 1,
    title: "Reunião Geral de Equipe",
    content: "Reunião agendada para discutir as metas do próximo trimestre e apresentar novos produtos. Presença obrigatória para todos os gerentes.",
    priority: "urgent",
    author: { name: "Direção", initials: "DR" },
    isPinned: true,
    createdAt: "2024-01-15T10:00:00",
  },
  {
    id: 2,
    title: "Novo Sistema de Comissões",
    content: "A partir de fevereiro, entraremos com o novo sistema de cálculo de comissões. Verifiquem os detalhes no portal.",
    priority: "important",
    author: { name: "RH", initials: "RH" },
    isPinned: true,
    createdAt: "2024-01-14T14:30:00",
  },
  {
    id: 3,
    title: "Horário de Funcionamento - Carnaval",
    content: "Durante o período de Carnaval, as lojas funcionarão em horário reduzido. Confiram a escala de cada unidade.",
    priority: "normal",
    author: { name: "Gerência", initials: "GR" },
    isPinned: false,
    createdAt: "2024-01-13T09:15:00",
  },
  {
    id: 4,
    title: "Chegada de Nova Coleção",
    content: "Nova coleção de primavera-verão chegará na próxima semana. Preparem o estoque e vitrines.",
    priority: "normal",
    author: { name: "Direção", initials: "DR" },
    isPinned: false,
    createdAt: "2024-01-12T16:45:00",
  },
];

const priorityConfig = {
  urgent: {
    icon: AlertTriangle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-900/10",
    borderColor: "border-red-200 dark:border-red-900/30",
    label: "Urgente",
  },
  important: {
    icon: AlertCircle,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-900/10",
    borderColor: "border-orange-200 dark:border-orange-900/30",
    label: "Importante",
  },
  normal: {
    icon: Info,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-900/10",
    borderColor: "border-blue-200 dark:border-blue-900/30",
    label: "Normal",
  },
};

export default function Avisos() {
  const [filter, setFilter] = useState<"all" | "pinned">("all");

  const filteredAnnouncements = filter === "pinned"
    ? mockAnnouncements.filter(a => a.isPinned)
    : mockAnnouncements;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Avisos e Comunicados
          </h1>
          <p className="text-muted-foreground mt-1">Comunicações importantes da direção</p>
        </div>
        <Button data-testid="button-new-announcement">
          <Plus className="h-4 w-4 mr-2" />
          Novo Aviso
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={filter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("all")}
          data-testid="button-filter-all"
        >
          <Bell className="h-4 w-4 mr-2" />
          Todos
        </Button>
        <Button
          variant={filter === "pinned" ? "default" : "outline"}
          size="sm"
          onClick={() => setFilter("pinned")}
          data-testid="button-filter-pinned"
        >
          <Pin className="h-4 w-4 mr-2" />
          Fixados
        </Button>
      </div>

      <div className="space-y-4">
        {filteredAnnouncements.map((announcement) => {
          const config = priorityConfig[announcement.priority as keyof typeof priorityConfig];
          const Icon = config.icon;

          return (
            <Card
              key={announcement.id}
              className={cn(
                "hover-elevate border-l-4",
                config.borderColor,
                config.bgColor
              )}
              data-testid={`card-announcement-${announcement.id}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn("p-2 rounded-md bg-background/50", config.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg font-display">{announcement.title}</CardTitle>
                        {announcement.isPinned && (
                          <Pin className="h-4 w-4 text-muted-foreground" fill="currentColor" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">
                            {announcement.author.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span>{announcement.author.name}</span>
                        <span>•</span>
                        <span>{new Date(announcement.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}</span>
                        <Badge variant="secondary" className={config.color}>
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-foreground leading-relaxed">{announcement.content}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
