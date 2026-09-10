import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getState, getMeta, getFlywheel, getLedger, getHistory, getTokenLive, getWallet, getVault } from '@/lib/api';

const live = (interval) => ({ refetchInterval: interval, staleTime: 0, retry: 1 });

export const useAppState = () => useQuery({ queryKey: ['state'], queryFn: getState, ...live(6000) });
export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: getMeta, staleTime: Infinity });
export const useFlywheel = () => useQuery({ queryKey: ['flywheel'], queryFn: getFlywheel, ...live(5000) });
export const useLedger = (limit = 120) => useQuery({ queryKey: ['ledger', limit], queryFn: () => getLedger(limit), ...live(8000) });
export const useHistory = () => useQuery({ queryKey: ['history'], queryFn: getHistory, ...live(30000) });
export const useTokenLive = () => useQuery({ queryKey: ['token'], queryFn: getTokenLive, ...live(20000) });
export const useVault = () => useQuery({ queryKey: ['vault'], queryFn: getVault, ...live(8000) });
export const useWallet = (address) =>
  useQuery({ queryKey: ['wallet', address], queryFn: () => getWallet(address), enabled: !!address && address.length >= 32, ...live(30000) });

export const useRefresh = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
};
