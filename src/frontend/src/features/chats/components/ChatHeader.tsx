import { ArrowLeft, Users } from 'lucide-react';
import { Avatar } from '../../../shared/components/Avatar';
import type { Conversation } from '../types';

type ChatHeaderProps = {
  conversation: Conversation;
  typingText?: string;
  onBack: () => void;
  onOpenDetails: () => void;
};

export function ChatHeader({ conversation, typingText, onBack, onOpenDetails }: ChatHeaderProps) {
  return (
    <header className="chat-panel-header">
      <button className="icon-button mobile-only" type="button" onClick={onBack} aria-label="Back" title="Back">
        <ArrowLeft size={19} />
      </button>
      <Avatar name={conversation.name} src={conversation.avatar} status={conversation.user?.status} />
      <div className="chat-title">
        <strong>{conversation.name}</strong>
        <span>{typingText || (conversation.type === 'group' ? `${conversation.memberCount} members` : conversation.user?.status || 'direct')}</span>
      </div>
      <button className="icon-button" type="button" onClick={onOpenDetails} aria-label="Conversation details" title="Conversation details">
        <Users size={19} />
      </button>
    </header>
  );
}
