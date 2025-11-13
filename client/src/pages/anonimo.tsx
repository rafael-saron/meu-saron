import { useState } from "react";
import { Send, Shield, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/lib/user-context";

const mockAnonymousMessages = [
  {
    id: 1,
    content: "Gostaria de sugerir horários de almoço mais flexíveis para a equipe.",
    sender: { name: "João Silva", initials: "JS" },
    isRead: false,
    createdAt: "2024-01-15T14:30:00",
  },
  {
    id: 2,
    content: "O ar condicionado da loja está muito frio, várias pessoas estão reclamando.",
    sender: { name: "Maria Santos", initials: "MS" },
    isRead: true,
    createdAt: "2024-01-14T10:15:00",
  },
  {
    id: 3,
    content: "Seria ótimo ter um curso de atendimento ao cliente para toda a equipe.",
    sender: { name: "Pedro Costa", initials: "PC" },
    isRead: true,
    createdAt: "2024-01-12T16:45:00",
  },
];

export default function Anonimo() {
  const [message, setMessage] = useState("");
  const { user, isAdmin } = useUser();
  const { toast } = useToast();

  const handleSend = () => {
    if (!message.trim()) return;

    toast({
      title: "Mensagem enviada",
      description: "Sua mensagem foi enviada anonimamente para a direção.",
    });

    setMessage("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
          Mensagens Anônimas
        </h1>
        <p className="text-muted-foreground mt-1">
          {isAdmin ? "Visualize mensagens recebidas" : "Envie sugestões ou reclamações de forma anônima"}
        </p>
      </div>

      {!isAdmin && (
        <Card className="border-primary/20 bg-primary/5" data-testid="card-send-anonymous">
          <CardHeader>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg font-display">Enviar Mensagem Anônima</CardTitle>
                <CardDescription className="mt-1">
                  Sua mensagem será enviada de forma anônima para a direção. Apenas os administradores terão acesso à sua identidade.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Digite sua mensagem, sugestão ou reclamação aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[150px] resize-none"
              data-testid="textarea-anonymous-message"
            />
            <div className="flex justify-end">
              <Button onClick={handleSend} data-testid="button-send-anonymous">
                <Send className="h-4 w-4 mr-2" />
                Enviar Anonimamente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Eye className="h-4 w-4" />
            <p>Apenas administradores podem visualizar o remetente das mensagens</p>
          </div>

          {mockAnonymousMessages.map((msg) => (
            <Card key={msg.id} className="hover-elevate" data-testid={`card-anonymous-message-${msg.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-foreground leading-relaxed mb-3">{msg.content}</p>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs bg-muted">
                            {msg.sender.initials}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{msg.sender.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          Remetente Real
                        </Badge>
                      </div>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">
                        {new Date(msg.createdAt).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {!msg.isRead && (
                        <Badge className="ml-auto">Nova</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
