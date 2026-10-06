/**
 * Who is signed in and which workspace is open. Lives in this browser only (localStorage), never in the repo.
 * The GitHub key is kept here; signing out removes it together with the local copies of workspaces.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { RepoRef } from '@/github/api'
import type { Person } from '@/model/schema'

export interface Session {
  token: string
  /** you, as GitHub knows you */
  user: Person | null
  workspace: RepoRef | null
  /** workspaces opened before, newest first */
  recent: RepoRef[]
  /** first-visit tips already shown */
  toured: boolean
  signIn: (token: string, user: Person) => void
  open: (ws: RepoRef) => void
  close: () => void
  signOut: () => void
  set: (patch: Partial<Pick<Session, 'toured' | 'user'>>) => void
}

export const useSession = create<Session>()(
  persist(
    (set) => ({
      token: '',
      user: null,
      workspace: null,
      recent: [],
      toured: false,
      signIn: (token, user) => set({ token, user }),
      open: (ws) =>
        set((s) => ({
          workspace: ws,
          recent: [ws, ...s.recent.filter((r) => `${r.owner}/${r.repo}`.toLowerCase() !== `${ws.owner}/${ws.repo}`.toLowerCase())].slice(0, 10),
        })),
      close: () => set({ workspace: null }),
      signOut: () => set({ token: '', user: null, workspace: null, recent: [], toured: false }),
      set: (patch) => set(patch),
    }),
    { name: 'sprawniej-session' },
  ),
)
