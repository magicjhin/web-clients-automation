/**
 * sw-register.tsx — клиентский компонент регистрации Service Worker.
 *
 * Тихо регистрирует /sw.js при монтировании. Не выводит никакого UI.
 * Подключается в layout.tsx внутри <body>.
 */

'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => {
        // Non-fatal — PWA работает без SW в dev-режиме или при ошибках политики
        console.warn('[SW] Registration failed:', err);
      });
  }, []);

  return null;
}
