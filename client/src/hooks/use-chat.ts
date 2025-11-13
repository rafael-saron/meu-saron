import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ChatMessage, InsertChatMessage } from "@shared/schema";

export function useChatMessages(userId1: string, userId2: string) {
  return useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", userId1, userId2],
    enabled: !!userId1 && !!userId2,
  });
}

export function useMarkMessagesAsRead() {
  return useMutation({
    mutationFn: async ({ senderId, receiverId }: { senderId: string; receiverId: string }) => {
      return await apiRequest("POST", "/api/chat/mark-as-read", { senderId, receiverId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/unread-count", variables.receiverId],
      });
    },
  });
}

export function useSendMessage() {
  return useMutation({
    mutationFn: async (data: InsertChatMessage) => {
      return await apiRequest("POST", "/api/chat/messages", data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/messages", variables.senderId, variables.receiverId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/messages", variables.receiverId, variables.senderId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/unread-count", variables.receiverId],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/chat/unread-count", variables.senderId],
      });
    },
  });
}
