import { SendHorizontal, X } from 'lucide-react';
import type { Message } from '../types';

type MessageComposerProps = {
  value: string;
  disabled: boolean;
  sending: boolean;
  editing: boolean;
  replyTo: Message | null;
  onChange: (value: string) => void;
  onSend: () => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
};

export function MessageComposer({
  value,
  disabled,
  sending,
  editing,
  replyTo,
  onChange,
  onSend,
  onCancelEdit,
  onCancelReply,
}: MessageComposerProps) {
  return (
    <footer className={`composer-wrap ${editing ? 'is-editing' : ''} ${replyTo ? 'is-replying' : ''}`}>
      {editing && (
        <div className="editing-strip">
          <span>Editing message</span>
          <button type="button" onClick={onCancelEdit}>Cancel</button>
        </div>
      )}
      {!editing && replyTo && (
        <div className="editing-strip">
          <span>
            Replying to <strong>{replyTo.sender?.username || 'message'}</strong>: {replyTo.content}
          </span>
          <button type="button" onClick={onCancelReply} aria-label="Cancel reply" title="Cancel reply">
            <X size={14} />
          </button>
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
