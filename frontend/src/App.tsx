import React, { useState, useRef, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, type Message } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { sendMessage } from './api';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatId, setChatId] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize a stable chat session ID on first load
  useEffect(() => {
    setChatId(uuidv4());
  }, []);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');
    
    // Add User message
    const userMessage: Message = {
      id: uuidv4(),
      role: 'user',
      content: userText,
    };
    setMessages((prev) => [...prev, userMessage]);
    
    setIsLoading(true);

    try {
      const response = await sendMessage(userText, chatId);
      
      const assistantMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: response.response,
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        id: uuidv4(),
        role: 'assistant',
        content: `**Error:** ${error.message || 'Something went wrong while connecting to the AI Gateway.'}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-zinc-900 overflow-hidden font-sans text-zinc-100">
      
      {/* Header */}
      <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center justify-between max-w-3xl mx-auto px-4 py-3 md:px-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <span className="text-emerald-400 font-bold tracking-tighter">AI</span>
            </div>
            <h1 className="font-semibold text-zinc-100 tracking-tight">Smart Gateway</h1>
          </div>
          <div className="text-xs text-zinc-500 border border-zinc-800 rounded-full px-2 py-0.5">
            Beta
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto scroll-smooth">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4 px-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 mb-4">
              <span className="text-2xl">✨</span>
            </div>
            <h2 className="text-xl font-medium text-zinc-300">How can I help you today?</h2>
            <p className="max-w-sm text-sm leading-relaxed">
              Experience lightning-fast responses with our intelligent caching layer and dynamic Llama model routing.
            </p>
          </div>
        ) : (
          <div className="flex flex-col pb-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            
            {isLoading && (
              <div className="flex w-full px-4 py-6 md:px-6 bg-zinc-800/50">
                <div className="flex w-full max-w-3xl mx-auto gap-4 md:gap-6">
                  <div className="flex items-center justify-center w-8 h-8 rounded-md shrink-0 border bg-teal-900 border-teal-700 text-teal-300">
                    <div className="w-4 h-4 border-2 border-teal-300/30 border-t-teal-300 rounded-full animate-spin" />
                  </div>
                  <div className="flex flex-col gap-2 min-w-0 flex-1 justify-center">
                    <div className="flex items-center gap-1.5 text-zinc-400 text-sm font-medium">
                      <span className="animate-pulse">Thinking</span>
                      <span className="flex gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" />
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} className="h-4" />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent pt-4">
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={handleSubmit}
          isLoading={isLoading}
        />
      </div>

    </div>
  );
}

export default App;
