import { useEffect } from 'react'
import { getToken } from 'firebase/messaging'
import { messaging } from '../lib/firebase'
import { supabase } from '../lib/supabase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export function useFcmToken(userId: string | undefined) {
  useEffect(() => {
    if (!userId || !messaging || !('Notification' in window)) return

    const register = async () => {
      try {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') return

        const token = await getToken(messaging!, { vapidKey: VAPID_KEY })
        if (!token) return

        await supabase
          .from('user_push_tokens')
          .upsert({ user_id: userId, fcm_token: token }, { onConflict: 'user_id,fcm_token' })
      } catch {
        // 토큰 등록 실패는 조용히 무시
      }
    }

    register()
  }, [userId])
}
