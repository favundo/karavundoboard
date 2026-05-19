import { useQuery } from '@tanstack/react-query';

export interface ESETComputer {
  uuid: string;
  name: string;
  ip: string | null;
  protectionStatus: number | null;
  statusLabel: string;
  statusColor: 'green' | 'yellow' | 'red' | 'gray';
  threats: number;
  antivirusVersion: string | null;
  lastConnectedTime: string | null;
  operatingSystem: string | null;
  loggedInUsers: string | null;
  consoleUrl: string;
}

export function useESETComputer(dns: string | null, sn: string | null) {
  const param = dns ? `dns=${encodeURIComponent(dns)}` : sn ? `sn=${encodeURIComponent(sn)}` : null;
  return useQuery<ESETComputer | null>({
    queryKey: ['eset-computer', dns, sn],
    queryFn: async () => {
      const res = await fetch(`/api/eset/computer?${param}`);
      if (res.status === 404) return null;
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!param,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
