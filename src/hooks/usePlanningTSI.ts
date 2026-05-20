import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DayCell      { value: string; tt: boolean }
export interface TechSchedule { name: string; schedule: DayCell[] }
export interface WeekPlan     { weekNumber: number; dates: string[]; technicians: TechSchedule[] }
export interface MonthPlan    { month: string; weeks: WeekPlan[] }

const QK = ['planning-tsi'] as const;
const db = supabase as any;

export function usePlanningTSI() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<MonthPlan | null> => {
      const { data, error } = await db
        .from('planning_tsi')
        .select('data')
        .eq('id', 'current')
        .maybeSingle();
      if (error) throw error;
      return data?.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSavePlanningTSI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: MonthPlan) => {
      const { error } = await db
        .from('planning_tsi')
        .upsert({ id: 'current', data: plan, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
