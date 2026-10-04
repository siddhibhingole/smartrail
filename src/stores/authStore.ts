import { create } from 'zustand'
import { getAccessToken } from '../services/api'
import type { ApiUser } from '../services/api'

type AuthSession = { token: string | null; user: ApiUser | null }
type AuthState = {
  session: AuthSession
  setSession: (session: AuthSession) => void
}

export const useAuthStore = create<AuthState>(set => ({
  session: { token: getAccessToken(), user: null },
  setSession: session => set({ session }),
}))
