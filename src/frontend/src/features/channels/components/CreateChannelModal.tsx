import { X } from 'lucide-react';

type CreateChannelModalProps = {
  open: boolean;
  name: string;
  description: string;
  submitting: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

export function CreateChannelModal({
  open,
  name,
  description,
  submitting,
  error,
  onNameChange,
  onDescriptionChange,
  onSubmit,
  onClose,
}: CreateChannelModalProps) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="modal-panel profile-modal" role="dialog" aria-modal="true" onMouseDown={event => event.stopPropagation()}>
        <header className="modal-header">
          <h2>New channel</h2>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close" title="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal-body">
          <input
            className="text-field"
            value={name}
            onChange={event => onNameChange(event.target.value)}
            placeholder="Channel name"
            maxLength={80}
          />
          <textarea
            className="details-textarea"
            value={description}
            onChange={event => onDescriptionChange(event.target.value)}
            placeholder="Description"
            maxLength={500}
          />
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
