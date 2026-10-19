/* Generated for FCM background messages — config client publique Firebase. */
/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyAMqcb5tHNtKJ-Jt8nzUnHzrErUk6dSRDA",
  authDomain: "kabakaba-43a55.firebaseapp.com",
  projectId: "kabakaba-43a55",
  messagingSenderId: "234320774252",
  appId: "1:234320774252:web:968f07cafb2a0d7ff60449",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'kabakaba';
  const body = payload.notification?.body || payload.data?.body || '';
  const kind = payload.data?.kind || 'INFO';
  self.registration.showNotification(title, {
    body,
    icon: '/pwa-192.png',
    badge: '/pwa-192.png',
    tag: kind,
    renotify: true,
    data: payload.data || {},
  });
});
