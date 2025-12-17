import { useState, useEffect, useRef } from "react";
import { Search, Send, Paperclip, MoreVertical, Plus } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useUser } from "@/lib/user-context";
import { useConversations, useChatMessages, useSendMessage, useMarkMessagesAsRead } from "@/hooks/use-chat";
import { queryClient } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";

export default function Chat() {
  const { user: currentUser } = useUser();
  const { data: conversationsData, isLoading: usersLoading } = useConversations(currentUser?.id || "");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: messages, isLoading: messagesLoading, dataUpdatedAt } = useChatMessages(
    currentUser?.id || "",
    selectedUserId || ""
  );
  const sendMessageMutation = useSendMessage();
  const markAsReadMutation = useMarkMessagesAsRead();

  const otherUsers = conversationsData?.users || [];
  const selectedUser = otherUsers.find((u) => u.id === selectedUserId);
  const lastMarkedKeyRef = useRef<string>("");

  useEffect(() => {
    if (!selectedUserId && otherUsers.length > 0) {
      setSelectedUserId(otherUsers[0].id);
    }
  }, [otherUsers, selectedUserId]);

  // Mark messages as read when conversation is viewed or new messages arrive
  useEffect(() => {
    if (!messagesLoading && messages && selectedUserId && currentUser?.id) {
      const lastMessageId = messages.length > 0 ? messages[messages.length - 1].id : "empty";
      const conversationKey = `${selectedUserId}-${lastMessageId}`;
      
      if (conversationKey !== lastMarkedKeyRef.current) {
        const timer = setTimeout(() => {
          if (!markAsReadMutation.isPending) {
            markAsReadMutation.mutate(
              {
                senderId: selectedUserId,
                receiverId: currentUser.id,
              },
              {
                onSuccess: () => {
                  lastMarkedKeyRef.current = conversationKey;
                },
              }
            );
          }
        }, 100);
        
        return () => clearTimeout(timer);
      }
    }
  }, [selectedUserId, currentUser?.id, messages, messagesLoading]);

  const filteredUsers = otherUsers.filter((u) =>
    u.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedUserId || !currentUser) return;

    await sendMessageMutation.mutateAsync({
      senderId: currentUser.id,
      receiverId: selectedUserId,
      content: messageInput,
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

  const handleNewConversation = () => {
    setSearchTerm("");
    setSelectedUserId(null);
    searchInputRef.current?.focus();
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
          <CardHeader className="border-b border-border pb-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-medium text-foreground">Conversas</h3>
              <Button
                variant="default"
                size="sm"
                onClick={handleNewConversation}
                data-testid="button-new-conversation"
                className="h-8"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nova
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
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
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      {user.avatar && <AvatarImage src={user.avatar} alt={user.fullName} />}
                      <AvatarFallback className="text-sm font-medium">
                        {getInitials(user.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    {user.unreadCount > 0 && (
                      <Badge 
                        className="absolute -top-1 -right-1 h-5 min-w-[1.25rem] px-1 flex items-center justify-center text-xs"
                        variant="destructive"
                        data-testid={`badge-unread-${user.id}`}
                      >
                        {user.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className={cn(
                        "font-medium truncate",
                        user.unreadCount > 0 ? "text-foreground font-semibold" : "text-foreground"
                      )}>{user.fullName}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {user.lastMessage ? (
                        <p className={cn(
                          "text-sm truncate",
                          user.unreadCount > 0 ? "text-foreground" : "text-muted-foreground"
                        )}>{user.lastMessage}</p>
                      ) : (
                        <p className="text-sm text-muted-foreground truncate capitalize">{user.role}</p>
                      )}
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
                      {selectedUser.avatar && <AvatarImage src={selectedUser.avatar} alt={selectedUser.fullName} />}
                      <AvatarFallback className="text-sm font-medium">
                        {getInitials(selectedUser.fullName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-foreground">{selectedUser.fullName}</p>
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
                              <p className="text-sm">{message.content}</p>
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
