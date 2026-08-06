import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findReminders, findPendingReminders, completeReminder, type ReminderRow } from "@/data/reminders";

export type Reminder = ReminderRow;

export function useReminders() {
  return useQuery({
    queryKey: queryKeys.reminders.all,
    queryFn: () => findReminders(),
  });
}

export function usePendingReminders() {
  return useQuery({
    queryKey: queryKeys.reminders.all,
    queryFn: () => findPendingReminders(5),
  });
}

export function useCompleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => completeReminder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reminders.all });
    },
  });
}
