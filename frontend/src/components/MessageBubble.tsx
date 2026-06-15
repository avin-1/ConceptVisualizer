// MessageBubble — renders a single chat message (user or assistant)

import type { Message } from '../types';

interface Props {
  message: Message;
}

export function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';

  return (
    <div className={`message-row ${isUser ? 'message-row--user' : 'message-row--ai'}`}>
      {!isUser && (
        <div className="message-avatar message-avatar--ai" aria-hidden="true">
          ✦
        </div>
      )}

      <div className={`message-bubble ${isUser ? 'message-bubble--user' : 'message-bubble--ai'}`}>
        <p className="message-text">{message.content}</p>
        <span className="message-time">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {isUser && (
        <div className="message-avatar message-avatar--user" aria-hidden="true">
          👤
        </div>
      )}
    </div>
  );
}
