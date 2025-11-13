import { useState, useEffect } from "react";
import { Search, Send, Paperclip, MoreVertical } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/user-context";
import { useUsers } from "@/hooks/use-users";
import { useChatMessages, useSendMessage } from "@/hooks/use-chat";
import { useWebSocket } from "@/hooks/use-websocket";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function Chat() {
  const { user: currentUser } = useUser();
  const { data: users, isLoading: usersLoading } = useUsers();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: messages, isLoading: messagesLoading } = useChatMessages(
    currentUser?.id || "",
    selectedUserId || ""
  );
  const sendMessageMutation = useSendMessage();

  useWebSocket({
    userId: currentUser?.id,
    onMessage: (data) => {
      if (data.type === "chat" && data.data) {
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/messages", data.data.senderId, data.data.receiverId] 
        });
        queryClient.invalidateQueries({ 
          queryKey: ["/api/chat/messages", data.data.receiverId, data.data.senderId] 
        });
      }
    },
  });

  const otherUsers = users?.filter((u) => u.id !== currentUser?.id) || [];
  const selectedUser = otherUsers.find((u) => u.id === selectedUserId);

  useEffect(() => {
    if (!selectedUserId && otherUsers.length > 0) {
      setSelectedUserId(otherUsers[0].id);
    }
  }, [otherUsers, selectedUserId]);

  const filteredUsers = otherUsers.filter((u) =>
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUserId || !currentUser) return;

    await sendMessageMutation.mutateAsync({
      senderId: currentUser.id,
      receiverId: selectedUserId,
      message: messageInput,
    });

    setMessageInput("");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (usersLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-semibold text-foreground" data-testid="text-page-title">
            Chat Interno
          </h1>
          <p className="text-muted-foreground mt-1">Converse com sua equipe em tempo real</p>
        </div>
        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px]" />
        </div>
      </div>
    );
  }

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
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUserId(user.id)}
                  className={cn(
                    "w-full flex items-start gap-3 p-3 rounded-md hover-elevate text-left",
                    selectedUserId === user.id && "bg-accent"
                  )}
                  data-testid={`button-conversation-${user.id}`}
                >
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm font-medium">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-medium text-foreground truncate">{user.name}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-muted-foreground truncate">{user.role}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </Card>

        <Card className="flex flex-col">
          {selectedUser ? (
            <>
              <CardHeader className="border-b border-border pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarFallback className="text-sm font-medium">
                        {getInitials(selectedUser.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{selectedUser.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{selectedUser.role}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" data-testid="button-chat-options">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 p-4">
                {messagesLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-12 w-2/3" />
                    <Skeleton className="h-12 w-2/3 ml-auto" />
                    <Skeleton className="h-12 w-2/3" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages && messages.length > 0 ? (
                      messages.map((message) => {
                        const isMine = message.senderId === currentUser?.id;
                        const messageTime = new Date(message.createdAt || "").toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });

                        return (
                          <div
                            key={message.id}
                            className={cn("flex", isMine ? "justify-end" : "justify-start")}
                            data-testid={`message-${message.id}`}
                          >
                            <div
                              className={cn(
                                "max-w-[70%] rounded-lg px-4 py-2",
                                isMine
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-foreground"
                              )}
                            >
                              <p className="text-sm">{message.message}</p>
                              <p
                                className={cn(
                                  "text-xs mt-1",
                                  isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                                )}
                              >
                                {messageTime}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <p>Nenhuma mensagem ainda. Comece a conversa!</p>
                      </div>
                    )}
                  </div>
                )}
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
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                    disabled={sendMessageMutation.isPending}
                    data-testid="input-message"
                  />
                  <Button
                    onClick={handleSendMessage}
                    disabled={!messageInput.trim() || sendMessageMutation.isPending}
                    data-testid="button-send-message"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-muted-foreground">
              <p>Selecione uma conversa para começar</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
