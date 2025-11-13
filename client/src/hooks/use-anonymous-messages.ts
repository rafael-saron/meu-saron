import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { AnonymousMessage, InsertAnonymousMessage } from "@shared/schema";

export function useAnonymousMessages() {
  return useQuery<AnonymousMessage[]>({
    queryKey: ["/api/anonymous-messages"],
  });
}

export function useCreateAnonymousMessage() {
  return useMutation({
    mutationFn: async (data: InsertAnonymousMessage) => {
      return await apiRequest("POST", "/api/anonymous-messages", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anonymous-messages"] });
    },
  });
}

export function useMarkAnonymousMessageAsRead() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("PATCH", `/api/anonymous-messages/${id}/read`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/anonymous-messages"] });
    },
  });
}
