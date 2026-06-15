// TypingIndicator — animated dots showing "AI is thinking"

export function TypingIndicator() {
  return (
    <div className="typing-indicator">
      <div className="typing-avatar">✦</div>
      <div className="typing-bubble">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </div>
    </div>
  );
}
