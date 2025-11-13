import { useState } from "react";
import { Search, Send, Paperclip, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const conversations = [
  { id: 1, user: { name: "João Silva", initials: "JS" }, lastMessage: "Oi, tudo bem?", time: "10:30", unread: 2 },
  { id: 2, user: { name: "Maria Santos", initials: "MS" }, lastMessage: "Confirmo o horário de amanhã", time: "09:15", unread: 0 },
  { id: 3, user: { name: "Pedro Costa", initials: "PC" }, lastMessage: "Obrigado pela ajuda!", time: "Ontem", unread: 0 },
  { id: 4, user: { name: "Ana Oliveira", initials: "AO" }, lastMessage: "Vou verificar e te retorno", time: "Ontem", unread: 1 },
];

const messages = [
  { id: 1, content: "Oi, tudo bem?", isMine: false, time: "10:25" },
  { id: 2, content: "Oi! Tudo ótimo, e você?", isMine: true, time: "10:27" },
  { id: 3, content: "Também! Conseguiu verificar aquele pedido?", isMine: false, time: "10:30" },
  { id: 4, content: "Sim, já está separado. Pode retirar hoje à tarde.", isMine: true, time: "10:32" },
];

export default function Chat() {
  const [selectedChat, setSelectedChat] = useState(conversations[0]);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredConversations = conversations.filter((conv) =>
    conv.user.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;
    setMessageInput("");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
          Chat Interno
        </h1>
        <p className="text-muted-foreground mt-1">Converse com sua equipe em tempo real</p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-280px)]">
        <Card className="flex flex-col">
          <CardHeader className="border-b border-border pb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-conversations"
              />
            </div>
          </CardHeader>
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredConversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setSelectedChat(conv)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-md hover-elevate text-left",
                    selectedChat.id === conv.id && "bg-accent"
                  )}
                  data-testid={`button-conversation-${conv.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm font-medium">
                      {conv.user.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">{conv.user.name}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{conv.time}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate">{conv.lastMessage}</p>
                      {conv.unread > 0 && (
                        <Badge className="h-5 min-w-5 flex items-center justify-center px-1.5">
                          {conv.unread}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="text-sm font-medium">
                    {selectedChat.user.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-foreground">{selectedChat.user.name}</p>
                  <p className="text-xs text-muted-foreground">Online</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" data-testid="button-chat-options">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    message.isMine ? "justify-end" : "justify-start"
                  )}
                  data-testid={`message-${message.id}`}
                >
                  <div
                    className={cn(
                      "max-w-[70%] rounded-lg px-4 py-2",
                      message.isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                    <p
                      className={cn(
                        "text-xs mt-1",
                        message.isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                      )}
                    >
                      {message.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <CardContent className="border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" data-testid="button-attach">
                <Paperclip className="h-4 w-4" />
              </Button>
              <Input
                placeholder="Digite uma mensagem..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                data-testid="input-message"
              />
              <Button onClick={handleSendMessage} data-testid="button-send-message">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
