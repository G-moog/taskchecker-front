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
  const title = payload.data?.title ?? 'TaskChecker'
  const body = payload.data?.body ?? ''
  const checklistId = payload.data?.checklistId

  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    // 같은 체크리스트 알림이 쌓이지 않게 한 장으로 덮어쓴다
    tag: checklistId ? `checklist-${checklistId}` : undefined,
    data: { checklistId },
  })
})

// 알림을 누르면 해당 체크리스트를 열고 미루기 화면을 띄운다
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const checklistId = event.notification.data && event.notification.data.checklistId
  const path = checklistId ? `/checklist/${checklistId}?notify=1` : '/'
  const url = new URL(path, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(url).then((c) => (c ? c.focus() : client.focus()))
          }
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    }),
  )
})
