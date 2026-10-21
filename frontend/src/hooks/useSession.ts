import { useQuery } from '@tanstack/react-query';
import { api, setCsrfToken } from '../lib/api';
import type { SessionState } from '../types/api';

export function useSession() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const session = await api<SessionState>('/auth/me');
      setCsrfToken(session.csrf_token ?? null);
      return session;
    },
    retry: false,
    staleTime: 30_000,
  });
}
