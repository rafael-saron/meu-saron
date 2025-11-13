import { useQuery } from "@tanstack/react-query";

export function useUnreadCount(userId: string | undefined) {
  return useQuery<{ count: number }>({
    queryKey: ["/api/chat/unread-count", userId],
    enabled: !!userId,
    refetchInterval: 5000,
  });
}
