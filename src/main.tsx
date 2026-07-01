import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App as CapApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import './index.css'
import App from './App.tsx'
import { supabase } from './lib/supabase'

if (Capacitor.isNativePlatform()) {
  CapApp.addListener('appUrlOpen', ({ url }) => {
    if (url.includes('login-callback')) {
      const fragment = url.split('#')[1] ?? url.split('?')[1] ?? ''
      const params = new URLSearchParams(fragment)
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken && refreshToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    }
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
