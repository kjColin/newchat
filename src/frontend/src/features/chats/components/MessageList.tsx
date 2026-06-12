import { CornerUpLeft, Edit3, Forward, MessageCircle, Trash2 } from 'lucide-react';
import type { RefObject } from 'react';
import { formatMessageTime } from '../../../shared/utils/time';
import type { User } from '../../auth/types';
import type { Message } from '../types';

type MessageListProps = {
  currentUser: User;
  messages: Message[];
  loading: boolean;
  error: string;
  bottomRef: RefObject<HTMLDivElement>;
  onEdit: (message: Message) => void;
  onDelete: (message: Message) => void;
  onReact: (message: Message, emoji: string) => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
};

const quickReactions = ['👍', '❤️', '😂', '😮'];

function aggregateReactions(message: Message, currentUserId: string) {
  const counts = new Map<string, { count: number; mine: boolean }>();

  message.reactions?.forEach(reaction => {
    const current = counts.get(reaction.emoji) || { count: 0, mine: false };
    current.count += 1;
    current.mine = current.mine || reaction.userId === currentUserId;
    counts.set(reaction.emoji, current);
  });

  return Array.from(counts.entries()).map(([emoji, value]) => ({ emoji, ...value }));
}

export function MessageList({
  currentUser,
  messages,
  loading,
  error,
  bottomRef,
  onEdit,
  onDelete,
  onReact,
  onReply,
  onForward,
}: MessageListProps) {
  if (loading) {
    return <div className="message-state">Loading messages...</div>;
  }

  if (error) {
    return <div className="message-state error">{error}</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="message-state">
        <MessageCircle size={34} />
        <span>No messages yet</span>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map(message => {
        const isOwn = message.senderId === currentUser.id;
        const deleted = Boolean(message.deletedAt);
        const reactions = aggregateReactions(message, currentUser.id);
        return (
          <div id={`message-${message.id}`} className={`message-row ${isOwn ? 'own' : ''} ${deleted ? 'deleted' : ''}`} key={message.id}>
            {!isOwn && <span className="message-author">{message.sender?.username}</span>}
            <div className="message-bubble">
              {message.replyTo && !deleted && (
                <span className="message-reference">
                  <strong>{message.replyTo.sender?.username || 'Message'}</strong>
                  {message.replyTo.deletedAt ? 'Message deleted' : message.replyTo.content}
                </span>
              )}
              {message.forwardFrom && !deleted && (
                <span className="message-reference">
                  <strong>Forwarded from {message.forwardFrom.sender?.username || 'unknown'}</strong>
                  {message.forwardFrom.deletedAt ? 'Message deleted' : message.forwardFrom.content}
                </span>
              )}
              <span className="message-content">{deleted ? 'Message deleted' : message.content}</span>
              <time>{message.editedAt && !deleted ? 'edited ' : ''}{formatMessageTime(message.createdAt)}</time>
            </div>
            {!deleted && (
              <div className="message-toolbar">
                {quickReactions.map(emoji => (
                  <button type="button" key={emoji} onClick={() => onReact(message, emoji)}>{emoji}</button>
                ))}
                <button type="button" onClick={() => onReply(message)} title="Reply"><CornerUpLeft size={13} /></button>
                <button type="button" onClick={() => onForward(message)} title="Forward"><Forward size={13} /></button>
                {isOwn && (
                  <>
                    <button type="button" onClick={() => onEdit(message)} title="Edit"><Edit3 size={13} /></button>
                    <button type="button" onClick={() => onDelete(message)} title="Delete"><Trash2 size={13} /></button>
                  </>
                )}
              </div>
            )}
            {reactions.length > 0 && (
              <div className="reaction-strip">
                {reactions.map(reaction => (
                  <button
                    className={reaction.mine ? 'mine' : ''}
                    key={reaction.emoji}
                    type="button"
                    onClick={() => onReact(message, reaction.emoji)}
                  >
                    {reaction.emoji} {reaction.count}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
