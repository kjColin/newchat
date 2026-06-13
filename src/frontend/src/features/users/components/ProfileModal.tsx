import { Save, X } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import type { User } from '../../auth/types';

type ProfileModalProps = {
  open: boolean;
  user: User;
  username: string;
  avatar: string;
  searchable: boolean;
  allowDirectMessages: boolean;
  submitting: boolean;
  error: string;
  notice: string;
  onUsernameChange: (value: string) => void;
  onAvatarChange: (value: string) => void;
  onSearchableChange: (value: boolean) => void;
  onAllowDirectMessagesChange: (value: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function ProfileModal({
  open,
  user,
  username,
  avatar,
  searchable,
  allowDirectMessages,
  submitting,
  error,
  notice,
  onUsernameChange,
  onAvatarChange,
  onSearchableChange,
  onAllowDirectMessagesChange,
  onSubmit,
  onClose,
}: ProfileModalProps) {
  if (!open) return null;

  const trimmedUsername = username.trim();

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-title"
        onMouseDown={event => event.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="profile-title">Edit profile</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close" title="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <div className="profile-preview">
            <Avatar name={trimmedUsername || user.username} src={avatar.trim() || null} status="online" size="lg" />
            <span>
              <strong>{trimmedUsername || user.username}</strong>
              <small>{user.email}</small>
            </span>
          </div>

          <label className="form-field">
            <span>Username</span>
            <input
              value={username}
              onChange={event => onUsernameChange(event.target.value)}
              placeholder="Username"
              maxLength={32}
              autoFocus
            />
          </label>

          <label className="form-field">
            <span>Avatar URL</span>
            <input
              value={avatar}
              onChange={event => onAvatarChange(event.target.value)}
              placeholder="https://example.com/avatar.png"
              maxLength={500}
            />
          </label>

          <label className="toggle-field">
            <span>
              <strong>Search visibility</strong>
              <small>Allow people to find this account by username or email.</small>
            </span>
            <input
              type="checkbox"
              checked={searchable}
              onChange={event => onSearchableChange(event.target.checked)}
            />
          </label>

          <label className="toggle-field">
            <span>
              <strong>Direct messages</strong>
              <small>Allow non-contacts to start a direct chat.</small>
            </span>
            <input
              type="checkbox"
              checked={allowDirectMessages}
              onChange={event => onAllowDirectMessagesChange(event.target.checked)}
            />
          </label>

          {notice && <div className="state-banner success">{notice}</div>}
          {error && <div className="state-banner error">{error}</div>}
        </div>

        <footer className="modal-footer">
          <button className="text-button" type="button" onClick={onClose}>Cancel</button>
          <button
            className="solid-button"
            type="button"
            onClick={onSubmit}
            disabled={submitting || trimmedUsername.length < 2}
          >
            <Save size={16} />
            Save
          </button>
        </footer>
      </section>
    </div>
  );
}
