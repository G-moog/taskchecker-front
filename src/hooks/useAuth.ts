import { useEffect, useState } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

const NATIVE_REDIRECT = 'com.taskchecker.app://login-callback'
const WEB_REDIRECT = window.location.origin

export function useAuth() {
  const [state, setState] = useState<AuthState>({ user: null, session: null, loading: true })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setState({ user: session?.user ?? null, session, loading: false })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ user: session?.user ?? null, session, loading: false })
      if (event === 'SIGNED_IN' && Capacitor.isNativePlatform()) {
        Browser.close()
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    if (Capacitor.isNativePlatform()) {
      const { data } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: NATIVE_REDIRECT,
          skipBrowserRedirect: true,
        },
      })
      if (data?.url) {
        await Browser.open({ url: data.url })
      }
    } else {
      return supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: WEB_REDIRECT },
      })
    }
  }

  const signOut = () => supabase.auth.signOut()

  return { ...state, signInWithGoogle, signOut }
}
