import { Paperclip, SendHorizontal, X } from 'lucide-react';
import type { Attachment, Message } from '../types';

type MessageComposerProps = {
  value: string;
  disabled: boolean;
  sending: boolean;
  editing: boolean;
  replyTo: Message | null;
  attachments: Attachment[];
  onChange: (value: string) => void;
  onSend: () => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onSelectFiles: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
};

export function MessageComposer({
  value,
  disabled,
  sending,
  editing,
  replyTo,
  attachments,
  onChange,
  onSend,
  onCancelEdit,
  onCancelReply,
  onSelectFiles,
  onRemoveAttachment,
}: MessageComposerProps) {
  const canSend = Boolean(value.trim() || attachments.length > 0);

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
      {!editing && attachments.length > 0 && (
        <div className="attachment-strip">
          {attachments.map(attachment => (
            <span className="attachment-chip" key={attachment.id}>
              {attachment.kind === 'image' ? 'Image' : 'File'}: {attachment.fileName}
              <button type="button" onClick={() => onRemoveAttachment(attachment.id)} aria-label="Remove attachment" title="Remove attachment">
                <X size={13} />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="message-composer">
        <label className={`icon-button ${editing ? 'disabled' : ''}`} title="Attach file" aria-label="Attach file">
          <Paperclip size={19} />
          <input
            className="file-input"
            type="file"
            multiple
            disabled={editing || disabled || sending}
            onChange={event => {
              onSelectFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
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
          disabled={disabled || sending || !canSend}
          aria-label={editing ? 'Save' : 'Send'}
          title={editing ? 'Save' : 'Send'}
        >
          <SendHorizontal size={20} />
        </button>
      </div>
    </footer>
  );
}
