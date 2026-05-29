import { useQuery } from '@tanstack/react-query';

export interface OCSComputer {
  id: number;
  name: string;
  lastInventory: string | null;
  osName: string | null;
  ipAddress: string | null;
  totalRam: number | null;
  cpuName: string | null;
  userId: string | null;
  consoleUrl: string;
}

export function useOCSComputer(dns: string | null) {
  return useQuery<OCSComputer | null>({
    queryKey: ['ocs-computer', dns],
    queryFn: async () => {
      const res = await fetch(`/api/ocs/computer?dns=${encodeURIComponent(dns!)}`);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!dns,
    staleTime: 15 * 60 * 1000,
    retry: false,
  });
}
