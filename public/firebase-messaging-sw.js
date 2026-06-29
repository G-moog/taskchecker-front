importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCRgX5-oMnR_LNs48ct-DgzbtIXnfnVVQQ',
  authDomain: 'taskchecker-d44e6.firebaseapp.com',
  projectId: 'taskchecker-d44e6',
  storageBucket: 'taskchecker-d44e6.firebasestorage.app',
  messagingSenderId: '294381230251',
  appId: '1:294381230251:web:2c411c5ed76acb27607fee',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {}
  self.registration.showNotification(title ?? 'TaskChecker', {
    body: body ?? '',
    icon: '/pwa-192x192.png',
  })
})
