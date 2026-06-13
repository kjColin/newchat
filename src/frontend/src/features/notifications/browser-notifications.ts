import type { BrowserNotificationState } from './types';

export function getBrowserNotificationState(): BrowserNotificationState {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission as BrowserNotificationState;
}

export async function requestBrowserNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported' as const;
  return Notification.requestPermission();
}

export function showBrowserNotification(title: string, body: string, onClick?: () => void) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    tag: title,
    silent: false,
  });

  if (onClick) {
    notification.onclick = () => {
      window.focus();
      onClick();
      notification.close();
    };
  }
}
