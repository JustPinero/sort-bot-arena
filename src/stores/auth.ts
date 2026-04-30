import { create } from 'zustand';

export interface SessionUser {
  id: string;
  display_name: string;
  email: string;
}

interface AuthState {
  user: SessionUser | null;
  sessionLoaded: boolean;
  setUser: (user: SessionUser | null) => void;
  setSessionLoaded: (loaded: boolean) => void;
  clear: () => void;
}

const initial = { user: null, sessionLoaded: false } as const;

// Cookie auth — the browser holds the session, server resolves it on each
// request, so this store is just a render-side cache of the current user.
// No persistence: refresh re-probes /api/v1/auth/me and fills it in.
export const useAuthStore = create<AuthState>()((set) => ({
  ...initial,
  setUser: (user) => set({ user }),
  setSessionLoaded: (loaded) => set({ sessionLoaded: loaded }),
  clear: () => set({ ...initial, sessionLoaded: true }),
}));
