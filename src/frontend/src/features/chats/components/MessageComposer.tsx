import { SendHorizontal } from 'lucide-react';

type MessageComposerProps = {
  value: string;
  disabled: boolean;
  sending: boolean;
  editing: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancelEdit: () => void;
};

export function MessageComposer({ value, disabled, sending, editing, onChange, onSend, onCancelEdit }: MessageComposerProps) {
  return (
    <footer className={`composer-wrap ${editing ? 'is-editing' : ''}`}>
      {editing && (
        <div className="editing-strip">
          <span>Editing message</span>
          <button type="button" onClick={onCancelEdit}>Cancel</button>
        </div>
      )}
      <div className="message-composer">
        <input
          value={value}
          disabled={disabled || sending}
          onChange={event => onChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={editing ? 'Edit message' : 'Message'}
        />
        <button
          className="icon-button primary send-button"
          type="button"
          onClick={onSend}
          disabled={disabled || sending || !value.trim()}
          aria-label={editing ? 'Save' : 'Send'}
          title={editing ? 'Save' : 'Send'}
        >
          <SendHorizontal size={20} />
        </button>
      </div>
    </footer>
  );
}
