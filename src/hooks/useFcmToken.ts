import { useEffect } from 'react'
import { getToken, onMessage } from 'firebase/messaging'
import { FirebaseMessaging } from '@capacitor-firebase/messaging'
import { Capacitor } from '@capacitor/core'
import { messaging } from '../lib/firebase'
import { supabase } from '../lib/supabase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export function useFcmToken(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return

    const register = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          // 네이티브 앱: capacitor-firebase/messaging 사용
          await FirebaseMessaging.requestPermissions()
          const { token } = await FirebaseMessaging.getToken()
          if (!token) return
          await supabase
            .from('user_push_tokens')
            .upsert({ user_id: userId, fcm_token: token }, { onConflict: 'user_id' })
        } else {
          // 웹: 기존 web push 방식
          if (!messaging || !('Notification' in window)) return
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') return
          const token = await getToken(messaging!, { vapidKey: VAPID_KEY })
          if (!token) return
          await supabase
            .from('user_push_tokens')
            .upsert({ user_id: userId, fcm_token: token }, { onConflict: 'user_id' })
          // 포그라운드 메시지 무시 (서비스워커가 처리)
          onMessage(messaging!, () => {})
        }
      } catch {
        // 토큰 등록 실패는 조용히 무시
      }
    }

    register()
  }, [userId])
}
