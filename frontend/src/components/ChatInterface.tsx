// ChatInterface — main chat UI with message list, input, and generate button

import { useRef, useEffect, useState, type KeyboardEvent } from 'react';
import type { Message, AppState, GenerationStatus, VideoResult } from '../types';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { AnimationModal } from './AnimationModal';

interface Props {
  messages: Message[];
  appState: AppState;
  isTyping: boolean;
  generationStatus: GenerationStatus | null;
  videoResult: VideoResult | null;
  error: string | null;
  onSendMessage: (text: string) => void;
  onStartGeneration: () => void;
  onResetForNew: () => void;
  onStartFresh: () => void;
}

const WELCOME_HINTS = [
  'Pythagorean theorem',
  'Fourier Transform',
  'Euler\'s identity',
  'Gradient descent',
  'Fibonacci spiral',
  'Bayes\' theorem',
];

export function ChatInterface({
  messages,
  appState,
  isTyping,
  generationStatus,
  videoResult,
  error,
  onSendMessage,
  onStartGeneration,
  onResetForNew,
  onStartFresh,
}: Props) {
  const [inputText, setInputText] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Open modal when generation starts or video is ready
  useEffect(() => {
    if (appState === 'generating' || appState === 'video_ready' || appState === 'error') {
      setModalOpen(true);
    }
  }, [appState]);

  const handleSend = () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText('');
    onSendMessage(text);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleGenerateClick = () => {
    setModalOpen(true);
    onStartGeneration();
  };

  const handleModalClose = () => {
    setModalOpen(false);
  };

  const handleGenerateAnother = () => {
    setModalOpen(false);
    onResetForNew();
  };

  const isInputDisabled = isTyping || appState === 'generating';
  const showGenerate = appState === 'ready_to_generate' || appState === 'video_ready';

  return (
    <div className="chat-wrapper">
      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-icon">✦</span>
          <span className="brand-name">ManimAI</span>
        </div>
        <p className="sidebar-tagline">Math animations powered by AI</p>

        <div className="sidebar-divider" />

        <div className="sidebar-section">
          <h3 className="sidebar-section-title">Try These Topics</h3>
          <ul className="hints-list">
            {WELCOME_HINTS.map((hint) => (
              <li key={hint}>
                <button
                  className="hint-chip"
                  onClick={() => !isInputDisabled && onSendMessage(hint)}
                  disabled={isInputDisabled}
                >
                  {hint}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="sidebar-divider" />

        <button className="btn btn--ghost sidebar-new" onClick={onStartFresh} id="new-chat-btn">
          + New Animation
        </button>

        <div className="sidebar-footer">
          <span>Powered by Groq + Manim</span>
        </div>
      </aside>

      {/* ── Main Chat Area ───────────────────────────────── */}
      <main className="chat-main">
        {/* Header */}
        <header className="chat-header">
          <div className="chat-header-info">
            <h1 className="chat-title">ManimAI Chat</h1>
            <span className="chat-subtitle">Describe a concept to animate</span>
          </div>
          {showGenerate && (
            <button
              className="btn btn--generate pulse-glow"
              onClick={handleGenerateClick}
              id="generate-animation-btn"
            >
              <span className="btn-icon">✨</span>
              Generate Animation
            </button>
          )}
        </header>

        {/* Messages */}
        <div className="messages-area" id="messages-container">
          {messages.length === 0 && (
            <div className="welcome-screen">
              <div className="welcome-icon">✦</div>
              <h2 className="welcome-title">Welcome to ManimAI</h2>
              <p className="welcome-subtitle">
                Tell me a math or science concept you'd like to see animated —
                like <em>Fourier Transform</em> or <em>the Pythagorean theorem</em>.
              </p>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="input-area">
          {showGenerate && (
            <div className="generate-banner">
              <span>✅ I have enough context to animate this!</span>
              <button
                className="btn btn--generate-inline"
                onClick={handleGenerateClick}
                id="generate-inline-btn"
              >
                Generate Animation ✨
              </button>
            </div>
          )}

          <div className="input-box">
            <textarea
              ref={inputRef}
              id="chat-input"
              className="chat-input"
              placeholder={
                appState === 'greeting'
                  ? 'Describe a concept to animate... (e.g. "Fourier Transform")'
                  : 'Continue the conversation...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isInputDisabled}
              rows={2}
            />
            <button
              className="send-btn"
              onClick={handleSend}
              disabled={isInputDisabled || !inputText.trim()}
              id="send-message-btn"
              aria-label="Send message"
            >
              ➤
            </button>
          </div>
          <p className="input-hint">Enter to send · Shift+Enter for new line</p>
        </div>
      </main>

      {/* ── Modal ───────────────────────────────────────── */}
      <AnimationModal
        isOpen={modalOpen}
        isGenerating={appState === 'generating'}
        generationStatus={generationStatus}
        videoResult={videoResult}
        error={error}
        onClose={handleModalClose}
        onGenerateAnother={handleGenerateAnother}
      />
    </div>
  );
}
