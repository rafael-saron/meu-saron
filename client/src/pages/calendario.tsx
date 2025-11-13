import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const employees = [
  { id: 1, name: "João Silva", initials: "JS" },
  { id: 2, name: "Maria Santos", initials: "MS" },
  { id: 3, name: "Pedro Costa", initials: "PC" },
  { id: 4, name: "Ana Oliveira", initials: "AO" },
];

const mockEvents = [
  { id: 1, userId: 1, title: "Horário Normal", type: "normal", date: "2024-01-15", startTime: "09:00", endTime: "18:00" },
  { id: 2, userId: 1, title: "Hora Extra", type: "extra", date: "2024-01-20", startTime: "18:00", endTime: "22:00" },
  { id: 3, userId: 2, title: "Horário Normal", type: "normal", date: "2024-01-15", startTime: "08:00", endTime: "17:00" },
  { id: 4, userId: 3, title: "Horário Normal", type: "normal", date: "2024-01-16", startTime: "09:00", endTime: "18:00" },
];

const getDaysInMonth = (year: number, month: number) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  return { daysInMonth, startingDayOfWeek };
};

export default function Calendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const { daysInMonth, startingDayOfWeek } = getDaysInMonth(year, month);

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
    return mockEvents.filter(event => event.date === dateStr);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Calendário de Horários
          </h1>
          <p className="text-muted-foreground mt-1">Gerencie os horários normais e extras da equipe</p>
        </div>
        <Button data-testid="button-add-event">
          <Plus className="h-4 w-4 mr-2" />
          Novo Horário
        </Button>
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
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
              <div key={day} className="bg-muted p-3 text-center text-sm font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const events = getEventsForDay(day);
              return (
                <div
                  key={index}
                  className={cn(
                    "bg-card p-3 min-h-[100px] hover-elevate",
                    !day && "bg-muted/30"
                  )}
                  data-testid={day ? `cell-day-${day}` : undefined}
                >
                  {day && (
                    <>
                      <div className="text-sm font-medium text-foreground mb-2">{day}</div>
                      <div className="space-y-1">
                        {events.map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "text-xs px-2 py-1 rounded-md",
                              event.type === "normal"
                                ? "bg-primary/10 text-primary dark:bg-primary/20"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            )}
                          >
                            {event.startTime} - {event.endTime}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-team-schedule">
        <CardHeader>
          <CardTitle className="text-lg font-display">Horários da Equipe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {employees.map((employee) => {
              const employeeEvents = mockEvents.filter(e => e.userId === employee.id);
              return (
                <div key={employee.id} className="flex items-start gap-4 pb-4 border-b border-border last:border-0 last:pb-0">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm font-medium">
                      {employee.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium text-foreground mb-2">{employee.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {employeeEvents.map((event) => (
                        <Badge
                          key={event.id}
                          variant={event.type === "normal" ? "secondary" : "default"}
                          className="gap-2"
                        >
                          {new Date(event.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                          <span className="text-muted-foreground">•</span>
                          {event.startTime}-{event.endTime}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
