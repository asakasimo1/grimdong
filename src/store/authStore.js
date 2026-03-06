import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  user: null,
  profile: null,
  loading: true,

  init: async () => {
    // [테스트 모드] 카카오 로그인 없이 mock 유저 사용
    const mockUser = { id: 'test-user', user_metadata: { name: '테스트' } }
    const { data: { session } } = await supabase.auth.getSession()
    set({ user: session?.user ?? mockUser, loading: false })

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null })
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  },
}))
