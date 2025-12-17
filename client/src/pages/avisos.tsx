import { useState } from "react";
import { Bell, Pin, Plus, AlertTriangle, Info, AlertCircle, Trash2, Pencil, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import type { User, Announcement } from "@shared/schema";

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

const storeLabels: Record<string, string> = {
  saron1: "Saron 1",
  saron2: "Saron 2",
  saron3: "Saron 3",
};

export default function Avisos() {
  const [filter, setFilter] = useState<"all" | "pinned">("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const { toast } = useToast();

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: announcements = [], isLoading } = useQuery<Announcement[]>({
    queryKey: ['/api/announcements'],
  });

  const [formData, setFormData] = useState({
    title: "",
    content: "",
    priority: "normal",
    isPinned: false,
    storeIds: [] as string[],
  });

  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      priority: "normal",
      isPinned: false,
      storeIds: [],
    });
    setEditingAnnouncement(null);
  };

  const openNewDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      priority: announcement.priority,
      isPinned: announcement.isPinned,
      storeIds: announcement.storeIds || [],
    });
    setIsDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/announcements', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Aviso criado",
        description: "O aviso foi publicado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar aviso",
        description: error.message || "Ocorreu um erro ao criar o aviso.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PATCH', `/api/announcements/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Aviso atualizado",
        description: "O aviso foi atualizado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar aviso",
        description: error.message || "Ocorreu um erro ao atualizar o aviso.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/announcements'] });
      toast({
        title: "Aviso removido",
        description: "O aviso foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover aviso",
        description: error.message || "Ocorreu um erro ao remover o aviso.",
        variant: "destructive",
      });
    },
  });

  const toggleStoreId = (storeId: string) => {
    setFormData(prev => ({
      ...prev,
      storeIds: prev.storeIds.includes(storeId)
        ? prev.storeIds.filter(id => id !== storeId)
        : [...prev.storeIds, storeId]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.content) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o título e o conteúdo do aviso.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      title: formData.title,
      content: formData.content,
      priority: formData.priority,
      isPinned: formData.isPinned,
      storeIds: formData.storeIds,
      authorId: currentUser?.id,
    };

    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const getAuthorName = (authorId: string) => {
    const author = users.find(u => u.id === authorId);
    return author?.fullName || 'Autor';
  };

  const getAuthorInitials = (authorId: string) => {
    const author = users.find(u => u.id === authorId);
    if (!author?.fullName) return 'AU';
    return author.fullName.split(' ').filter((n: string) => n).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStoreLabel = (storeIds: string[] | null) => {
    if (!storeIds || storeIds.length === 0) return "Todas as lojas";
    if (storeIds.length === 3) return "Todas as lojas";
    return storeIds.map(id => storeLabels[id] || id).join(", ");
  };

  const filteredAnnouncements = filter === "pinned"
    ? announcements.filter(a => a.isPinned)
    : announcements;

  const canManageAnnouncements = currentUser?.role === 'administrador' || currentUser?.role === 'gerente';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Avisos e Comunicados
          </h1>
          <p className="text-muted-foreground mt-1">Comunicações importantes da direção</p>
        </div>
        {canManageAnnouncements && (
          <Button onClick={openNewDialog} data-testid="button-new-announcement">
            <Plus className="h-4 w-4 mr-2" />
            Novo Aviso
          </Button>
        )}
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

      {isLoading ? (
        <div className="space-y-4">
          {Array(3).fill(0).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {filter === "pinned" 
                ? "Nenhum aviso fixado no momento." 
                : "Nenhum aviso publicado ainda."}
            </p>
            {canManageAnnouncements && (
              <Button 
                className="mt-4" 
                onClick={openNewDialog}
              >
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro aviso
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((announcement) => {
            const config = priorityConfig[announcement.priority as keyof typeof priorityConfig] || priorityConfig.normal;
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
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <CardTitle className="text-lg font-display">{announcement.title}</CardTitle>
                          {announcement.isPinned && (
                            <Pin className="h-4 w-4 text-muted-foreground" fill="currentColor" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getAuthorInitials(announcement.authorId)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{getAuthorName(announcement.authorId)}</span>
                          <span className="hidden sm:inline">-</span>
                          <span>{new Date(announcement.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}</span>
                          <Badge variant="secondary" className={config.color}>
                            {config.label}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Store className="h-3 w-3" />
                            {getStoreLabel(announcement.storeIds)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    {canManageAnnouncements && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(announcement)}
                          className="text-muted-foreground hover:text-foreground"
                          data-testid={`button-edit-${announcement.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteMutation.mutate(announcement.id)}
                          className="text-muted-foreground hover:text-destructive"
                          data-testid={`button-delete-${announcement.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground leading-relaxed whitespace-pre-wrap">{announcement.content}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAnnouncement ? "Editar Aviso" : "Novo Aviso"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Título do aviso"
                  data-testid="input-title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content">Conteúdo *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Escreva o conteúdo do aviso..."
                  className="min-h-[120px]"
                  data-testid="input-content"
                />
              </div>
              <div className="grid gap-2">
                <Label>Lojas destinatárias</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Deixe vazio para enviar para todas as lojas
                </p>
                <div className="flex flex-wrap gap-4">
                  {["saron1", "saron2", "saron3"].map((storeId) => (
                    <div key={storeId} className="flex items-center gap-2">
                      <Checkbox
                        id={`store-${storeId}`}
                        checked={formData.storeIds.includes(storeId)}
                        onCheckedChange={() => toggleStoreId(storeId)}
                        data-testid={`checkbox-store-${storeId}`}
                      />
                      <Label htmlFor={`store-${storeId}`} className="text-sm font-normal cursor-pointer">
                        {storeLabels[storeId]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue placeholder="Selecione a prioridade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="important">Importante</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="isPinned">Fixar aviso</Label>
                  <p className="text-sm text-muted-foreground">
                    Avisos fixados aparecem no topo da lista
                  </p>
                </div>
                <Switch
                  id="isPinned"
                  checked={formData.isPinned}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isPinned: checked }))}
                  data-testid="switch-pinned"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit">
                {(createMutation.isPending || updateMutation.isPending) ? "Salvando..." : (editingAnnouncement ? "Salvar" : "Publicar")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
