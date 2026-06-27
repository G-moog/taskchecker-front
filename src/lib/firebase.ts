import { initializeApp } from 'firebase/app'
import { getMessaging } from 'firebase/messaging'

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID

// Firebase 설정값이 없으면 초기화 건너뜀
export const messaging = projectId
  ? getMessaging(initializeApp({
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    }))
  : null
