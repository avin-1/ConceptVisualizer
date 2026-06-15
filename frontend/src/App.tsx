import './App.css';
import { useChat } from './hooks/useChat';
import { ChatInterface } from './components/ChatInterface';

function App() {
  const {
    messages,
    appState,
    isTyping,
    generationStatus,
    videoResult,
    error,
    sendMessage,
    startGeneration,
    resetForNew,
    startFresh,
  } = useChat();

  return (
    <div className="app-container">
      <ChatInterface
        messages={messages}
        appState={appState}
        isTyping={isTyping}
        generationStatus={generationStatus}
        videoResult={videoResult}
        error={error}
        onSendMessage={sendMessage}
        onStartGeneration={startGeneration}
        onResetForNew={resetForNew}
        onStartFresh={startFresh}
      />
    </div>
  );
}

export default App;
