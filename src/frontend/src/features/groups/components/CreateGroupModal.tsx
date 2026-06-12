import { Check, Search, X } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import type { SearchUser } from '../../users/types';

type CreateGroupModalProps = {
  open: boolean;
  name: string;
  query: string;
  users: SearchUser[];
  selectedUsers: SearchUser[];
  submitting: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onToggleUser: (user: SearchUser) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function CreateGroupModal({
  open,
  name,
  query,
  users,
  selectedUsers,
  submitting,
  error,
  onNameChange,
  onQueryChange,
  onToggleUser,
  onSubmit,
  onClose,
}: CreateGroupModalProps) {
  if (!open) return null;

  const selectedIds = new Set(selectedUsers.map(user => user.id));

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <header className="modal-header">
          <h2>New group</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close" title="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <input
            className="text-field"
            value={name}
            onChange={event => onNameChange(event.target.value)}
            placeholder="Group name"
          />

          <label className="search-field modal-search">
            <Search size={17} />
            <input value={query} onChange={event => onQueryChange(event.target.value)} placeholder="Search people" />
          </label>

          {selectedUsers.length > 0 && (
            <div className="selected-users">
              {selectedUsers.map(user => (
                <button type="button" key={user.id} onClick={() => onToggleUser(user)}>
                  {user.username}
                  <X size={13} />
                </button>
              ))}
            </div>
          )}

          <div className="modal-user-list">
            {users.map(user => {
              const selected = selectedIds.has(user.id);
              return (
                <button className="user-row" type="button" key={user.id} onClick={() => onToggleUser(user)}>
                  <Avatar name={user.username} src={user.avatar} status={user.status} />
                  <span>
                    <strong>{user.username}</strong>
                    <small>{user.email}</small>
                  </span>
                  {selected && <Check size={18} />}
                </button>
              );
            })}
          </div>

          {error && <div className="state-banner error">{error}</div>}
        </div>

        <footer className="modal-footer">
          <button className="text-button" type="button" onClick={onClose}>Cancel</button>
          <button className="solid-button" type="button" onClick={onSubmit} disabled={submitting || !name.trim()}>
            Create
          </button>
        </footer>
      </section>
    </div>
  );
}
