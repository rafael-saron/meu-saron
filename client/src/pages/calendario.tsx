import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, X } from "lucide-react";
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
import type { User, ScheduleEvent } from "@shared/schema";

const getDaysInMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  return { daysInMonth, startingDayOfWeek };
};

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { toast } = useToast();
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(year, month);

  const { data: currentUser } = useQuery<User>({
    queryKey: ['/api/auth/me'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const startDate = new Date(year, month, 1).toISOString();
  const endDate = new Date(year, month + 1, 0).toISOString();
  
  const { data: events = [], isLoading } = useQuery<ScheduleEvent[]>({
    queryKey: ['/api/schedule', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('startDate', startDate);
      params.set('endDate', endDate);
      const res = await fetch(`/api/schedule?${params.toString()}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
  });

  const [formData, setFormData] = useState({
    userId: "",
    storeId: "",
    title: "",
    type: "normal",
    date: "",
    startTime: "09:00",
    endTime: "18:00",
    description: "",
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/schedule', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      setIsDialogOpen(false);
      resetForm();
      toast({
        title: "Horário criado",
        description: "O horário foi adicionado com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar horário",
        description: error.message || "Ocorreu um erro ao criar o horário.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/schedule/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/schedule'] });
      toast({
        title: "Horário removido",
        description: "O horário foi removido com sucesso.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover horário",
        description: error.message || "Ocorreu um erro ao remover o horário.",
        variant: "destructive",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      userId: "",
      storeId: currentUser?.storeId || "",
      title: "",
      type: "normal",
      date: "",
      startTime: "09:00",
      endTime: "18:00",
      description: "",
    });
    setSelectedDate(null);
  };

  const openDialog = (date?: string) => {
    if (date) {
      setFormData(prev => ({ ...prev, date }));
      setSelectedDate(date);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const storeIdToUse = formData.storeId || currentUser?.storeId;
    
    if (!formData.userId || !formData.date || !formData.title || !storeIdToUse) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios (incluindo a loja).",
        variant: "destructive",
      });
      return;
    }

    const startDateTime = new Date(`${formData.date}T${formData.startTime}:00`);
    const endDateTime = new Date(`${formData.date}T${formData.endTime}:00`);

    createMutation.mutate({
      userId: formData.userId,
      storeId: storeIdToUse,
      title: formData.title,
      type: formData.type,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      description: formData.description || null,
      createdById: currentUser?.id,
    });
  };

  const previousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getEventsForDay = (day: number | null) => {
    if (!day) return [];
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(event => {
      const eventDate = new Date(event.startTime).toISOString().split('T')[0];
      return eventDate === dateStr;
    });
  };

  const formatTime = (dateStr: string | Date) => {
    const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.fullName || 'Usuário';
  };

  const getUserInitials = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user?.fullName) return 'US';
    return user.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const activeUsers = users.filter(u => u.isActive && (u.role === 'vendedor' || u.role === 'gerente'));

  const canManageSchedule = currentUser?.role === 'administrador' || currentUser?.role === 'gerente';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Calendário de Horários
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os horários normais e extras da equipe</p>
        </div>
        {canManageSchedule && (
          <Button onClick={() => openDialog()} data-testid="button-add-event">
            <Plus className="h-4 w-4 mr-2" />
            Novo Horário
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-display capitalize">{monthName}</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={previousMonth} data-testid="button-prev-month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={nextMonth} data-testid="button-next-month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-7 gap-px">
              {Array(35).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                <div key={day} className="bg-muted p-3 text-center text-sm font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
              {days.map((day, index) => {
                const dayEvents = getEventsForDay(day);
                const dateStr = day ? `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` : '';
                return (
                  <div
                    key={index}
                    className={cn(
                      "bg-card p-3 min-h-[100px]",
                      !day && "bg-muted/30",
                      day && canManageSchedule && "cursor-pointer hover-elevate"
                    )}
                    onClick={() => day && canManageSchedule && openDialog(dateStr)}
                    data-testid={day ? `cell-day-${day}` : undefined}
                  >
                    {day && (
                      <>
                        <div className="text-sm font-medium text-foreground mb-2">{day}</div>
                        <div className="space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div
                              key={event.id}
                              className={cn(
                                "text-xs px-2 py-1 rounded-md flex items-center justify-between gap-1",
                                event.type === "normal"
                                  ? "bg-primary/10 text-primary dark:bg-primary/20"
                                  : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">
                                {formatTime(event.startTime)} - {formatTime(event.endTime)}
                              </span>
                              {canManageSchedule && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteMutation.mutate(event.id);
                                  }}
                                  className="hover:text-destructive flex-shrink-0"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          ))}
                          {dayEvents.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{dayEvents.length - 3} mais
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {events.length > 0 && (
        <Card data-testid="card-team-schedule">
          <CardHeader>
            <CardTitle className="text-lg font-display">Horários da Equipe</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeUsers.filter(user => events.some(e => e.userId === user.id)).map((user) => {
                const userEvents = events.filter(e => e.userId === user.id);
                return (
                  <div key={user.id} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm font-medium">
                        {getUserInitials(user.id)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-foreground mb-2">{user.fullName}</p>
                      <div className="flex flex-wrap gap-2">
                        {userEvents.slice(0, 5).map((event) => (
                          <Badge
                            key={event.id}
                            variant={event.type === "normal" ? "secondary" : "default"}
                            className="gap-2"
                          >
                            {new Date(event.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                            <span className="text-muted-foreground">-</span>
                            {formatTime(event.startTime)}-{formatTime(event.endTime)}
                            {canManageSchedule && (
                              <button
                                onClick={() => deleteMutation.mutate(event.id)}
                                className="ml-1 hover:text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </Badge>
                        ))}
                        {userEvents.length > 5 && (
                          <Badge variant="outline">+{userEvents.length - 5} mais</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {activeUsers.filter(user => events.some(e => e.userId === user.id)).length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum horário cadastrado para este mês.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Novo Horário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              {currentUser?.role === 'administrador' && (
                <div className="grid gap-2">
                  <Label htmlFor="storeId">Loja *</Label>
                  <Select
                    value={formData.storeId}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, storeId: value }))}
                  >
                    <SelectTrigger data-testid="select-store">
                      <SelectValue placeholder="Selecione a loja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="saron1">Saron 1</SelectItem>
                      <SelectItem value="saron2">Saron 2</SelectItem>
                      <SelectItem value="saron3">Saron 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="userId">Funcionário *</Label>
                <Select
                  value={formData.userId}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, userId: value }))}
                >
                  <SelectTrigger data-testid="select-user">
                    <SelectValue placeholder="Selecione o funcionário" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeUsers.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Ex: Horário Normal, Hora Extra..."
                  data-testid="input-title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="type">Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger data-testid="select-type">
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Horário Normal</SelectItem>
                    <SelectItem value="extra">Hora Extra</SelectItem>
                    <SelectItem value="folga">Folga</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date">Data *</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  data-testid="input-date"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startTime">Início</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    data-testid="input-start-time"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="endTime">Término</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    data-testid="input-end-time"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Observações (opcional)"
                  data-testid="input-description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit">
                {createMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
