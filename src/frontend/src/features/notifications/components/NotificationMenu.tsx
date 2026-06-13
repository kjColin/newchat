import { Bell, BellRing, CheckCheck, X } from 'lucide-react';
import { formatConversationTime } from '../../../shared/utils/time';
import type { BrowserNotificationState, NotificationItem } from '../types';

type NotificationMenuProps = {
  open: boolean;
  notifications: NotificationItem[];
  unreadCount: number;
  browserState: BrowserNotificationState;
  onToggleOpen: () => void;
  onEnableBrowserNotifications: () => void;
  onSelect: (notification: NotificationItem) => void;
  onMarkAllRead: () => void;
  onClear: () => void;
};

export function NotificationMenu({
  open,
  notifications,
  unreadCount,
  browserState,
  onToggleOpen,
  onEnableBrowserNotifications,
  onSelect,
  onMarkAllRead,
  onClear,
}: NotificationMenuProps) {
  const canEnableBrowser = browserState === 'default';

  return (
    <div className="notification-menu">
      <button
        className={`icon-button ${unreadCount > 0 ? 'has-notifications' : ''}`}
        type="button"
        onClick={onToggleOpen}
        aria-label="Notifications"
        title="Notifications"
      >
        {unreadCount > 0 ? <BellRing size={18} /> : <Bell size={18} />}
        {unreadCount > 0 && <span className="notification-count">{unreadCount}</span>}
      </button>

      {open && (
        <section className="notification-popover" aria-label="Notifications">
          <header className="notification-header">
            <strong>Notifications</strong>
            <span className="notification-actions">
              {canEnableBrowser && (
                <button type="button" onClick={onEnableBrowserNotifications}>Enable</button>
              )}
              <button type="button" onClick={onMarkAllRead} disabled={unreadCount === 0} title="Mark all read">
                <CheckCheck size={15} />
              </button>
              <button type="button" onClick={onClear} disabled={notifications.length === 0} title="Clear">
                <X size={15} />
              </button>
            </span>
          </header>

          {browserState === 'denied' && (
            <div className="notification-hint">Browser notifications are blocked.</div>
          )}

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">No notifications</div>
            ) : (
              notifications.map(notification => (
                <button
                  className={`notification-row ${notification.read ? '' : 'unread'}`}
                  type="button"
                  key={notification.id}
                  onClick={() => onSelect(notification)}
                >
                  <span>
                    <strong>{notification.title}</strong>
                    <small>{notification.body}</small>
                  </span>
                  <time>{formatConversationTime(notification.createdAt)}</time>
                </button>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}
