/**
 * push-toggle.tsx — клиентский компонент управления Web Push уведомлениями.
 *
 * Состояния:
 *  - unsupported: нет serviceWorker/PushManager/Notification → ничего не рендерит
 *  - ios-not-installed: iOS Safari без standalone → подсказка добавить на Домой
 *  - idle/loading/subscribed/unsubscribed
 *
 * API-контракт (backend):
 *  GET  /api/push/vapid-public-key → { key: string }
 *  POST /api/push/subscribe        ← sub.toJSON()  → { ok: true }
 *  POST /api/push/unsubscribe      ← { endpoint }  → { ok: true }
 */

'use client';

import { useEffect, useState, useCallback } from 'react';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a URL-safe Base64 string (VAPID public key) to Uint8Array,
 * which is required by pushManager.subscribe({ applicationServerKey }).
 */
function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

/** Detect iOS Safari (regardless of Chrome/Firefox wrappers on iOS) */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream;
}

/** Detect standalone / installed PWA mode */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // Safari-specific property
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

type PushState =
  | 'checking'      // определяем текущий статус при монтировании
  | 'unsupported'   // API недоступен
  | 'ios-hint'      // iOS, не установлено — показать подсказку
  | 'denied'        // пользователь запретил уведомления
  | 'off'           // поддерживается, не подписан
  | 'on'            // подписан
  | 'loading';      // в процессе subscribe/unsubscribe

// ── Компонент ─────────────────────────────────────────────────────────────────

interface PushToggleProps {
  /** Если compact=true — отображается как иконка-кнопка (для nav хедера) */
  compact?: boolean;
}

export function PushToggle({ compact = false }: PushToggleProps) {
  const [state, setState] = useState<PushState>('checking');
  const [error, setError] = useState<string | null>(null);

  // Определяем начальный статус при монтировании
  useEffect(() => {
    async function detectState() {
      // 1. Проверяем поддержку API
      if (
        typeof window === 'undefined' ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setState('unsupported');
        return;
      }

      // 2. iOS без standalone — Push работает только в установленном PWA
      if (isIOS() && !isStandalone()) {
        setState('ios-hint');
        return;
      }

      // 3. Проверяем разрешение
      if (Notification.permission === 'denied') {
        setState('denied');
        return;
      }

      // 4. Проверяем текущую подписку
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? 'on' : 'off');
      } catch {
        setState('off');
      }
    }

    detectState();
  }, []);

  const handleSubscribe = useCallback(async () => {
    setError(null);
    setState('loading');

    try {
      // 1. Запрос разрешения
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      // 2. Ждём готовности SW
      const reg = await navigator.serviceWorker.ready;

      // 3. Получаем VAPID public key
      const keyRes = await fetch('/api/push/vapid-public-key');
      if (!keyRes.ok) throw new Error('Не удалось получить VAPID ключ');
      const { key } = (await keyRes.json()) as { key: string };

      // 4. Подписываемся
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      // 5. Отправляем подписку на сервер
      const subRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!subRes.ok) throw new Error('Не удалось сохранить подписку');

      setState('on');
    } catch (err) {
      console.error('[PushToggle] Subscribe error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка подписки');
      // Определяем фактическое состояние после ошибки
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? 'on' : 'off');
      } catch {
        setState('off');
      }
    }
  }, []);

  const handleUnsubscribe = useCallback(async () => {
    setError(null);
    setState('loading');

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        // Уведомляем сервер
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        // Отписываемся локально
        await sub.unsubscribe();
      }

      setState('off');
    } catch (err) {
      console.error('[PushToggle] Unsubscribe error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка отписки');
      setState('on'); // откатываемся
    }
  }, []);

  // ── Рендер ──────────────────────────────────────────────────────────────────

  // Не показываем ничего если не поддерживается
  if (state === 'unsupported') return null;

  // iOS подсказка — показываем только в не-compact режиме (блок на странице)
  if (state === 'ios-hint') {
    if (compact) return null;
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        <BellIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
        <span>
          Добавьте на экран «Домой», чтобы включить уведомления.
          <br />
          <span className="text-xs text-amber-600">
            На iOS push-уведомления работают только в установленном PWA.
          </span>
        </span>
      </div>
    );
  }

  // Компактный вариант — кнопка для хедера nav
  if (compact) {
    const isOn = state === 'on';
    const isLoading = state === 'loading';
    const isDenied = state === 'denied';

    if (isDenied) return null; // не показываем если запрещено

    return (
      <button
        type="button"
        onClick={isOn ? handleUnsubscribe : handleSubscribe}
        disabled={isLoading || state === 'checking'}
        aria-label={isOn ? 'Выключить уведомления' : 'Включить уведомления'}
        aria-pressed={isOn}
        title={isOn ? 'Уведомления включены (нажмите, чтобы отключить)' : 'Включить уведомления'}
        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition
          disabled:opacity-50 disabled:cursor-not-allowed
          ${isOn
            ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
          }`}
      >
        {isLoading ? (
          <SpinnerIcon className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <BellIcon
            className={`h-4 w-4 ${isOn ? 'text-brand-600' : 'text-gray-400'}`}
            filled={isOn}
            aria-hidden="true"
          />
        )}
        <span className="hidden md:inline">
          {isOn ? 'Уведомления вкл' : 'Уведомления'}
        </span>
      </button>
    );
  }

  // Полный вариант — блок (например, на странице Сводки или в onboarding)
  const isOn = state === 'on';
  const isLoading = state === 'loading';
  const isDenied = state === 'denied';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BellIcon
            className={`h-5 w-5 ${isOn ? 'text-brand-600' : 'text-gray-400'}`}
            filled={isOn}
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">
              Push-уведомления
            </p>
            <p className="text-xs text-gray-500">
              {isDenied
                ? 'Разрешение заблокировано браузером'
                : isOn
                ? 'Вы получаете уведомления о новых лидах'
                : 'Уведомления о новых лидах и задачах'}
            </p>
          </div>
        </div>

        {/* Toggle switch */}
        {!isDenied && (
          <button
            type="button"
            role="switch"
            aria-checked={isOn}
            aria-label={isOn ? 'Выключить уведомления' : 'Включить уведомления'}
            onClick={isOn ? handleUnsubscribe : handleSubscribe}
            disabled={isLoading || state === 'checking'}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out
              focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${isOn ? 'bg-brand-600' : 'bg-gray-200'}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out
                ${isOn ? 'translate-x-5' : 'translate-x-0'}`}
            >
              {isLoading && (
                <SpinnerIcon
                  className="absolute inset-0 m-auto h-3 w-3 animate-spin text-gray-400"
                  aria-hidden="true"
                />
              )}
            </span>
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}

      {/* Denied hint */}
      {isDenied && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
          Уведомления заблокированы в настройках браузера. Разрешите их в настройках сайта и перезагрузите страницу.
        </p>
      )}
    </div>
  );
}

// ── Иконки ───────────────────────────────────────────────────────────────────

function BellIcon({
  className,
  filled = false,
  'aria-hidden': ariaHidden,
}: {
  className?: string;
  filled?: boolean;
  'aria-hidden'?: boolean | 'true';
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
    >
      {filled ? (
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
      ) : (
        <>
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
      )}
    </svg>
  );
}

function SpinnerIcon({
  className,
  'aria-hidden': ariaHidden,
}: {
  className?: string;
  'aria-hidden'?: boolean | 'true';
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden={ariaHidden}
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
