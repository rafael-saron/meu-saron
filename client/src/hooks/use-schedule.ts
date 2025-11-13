import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { ScheduleEvent, InsertScheduleEvent } from "@shared/schema";

export function useScheduleEvents(userId?: string) {
  return useQuery<ScheduleEvent[]>({
    queryKey: ["/api/schedule", userId],
    queryFn: async () => {
      const url = userId ? `/api/schedule?userId=${userId}` : "/api/schedule";
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch schedule events");
      return response.json();
    },
  });
}

export function useCreateScheduleEvent() {
  return useMutation({
    mutationFn: async (data: InsertScheduleEvent) => {
      return await apiRequest("POST", "/api/schedule", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    },
  });
}

export function useDeleteScheduleEvent() {
  return useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/schedule/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/schedule"] });
    },
  });
}
