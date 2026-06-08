import React, { useState, useRef, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { v4 as uuidv4 } from "uuid";
import { ChatMessage, type Message } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { sendMessageStream } from "./api";
import { Trash2, Share, Check } from "lucide-react";

function App() {
  const {
    isLoading: authLoading,
    isAuthenticated,
    error: authError,
    loginWithRedirect, 
    logout,
    user,
    getAccessTokenSilently,
  } = useAuth0();
  
  const [isInIframe, setIsInIframe] = useState(false);

  useEffect(() => {
    // Detect if the app is running inside the Hugging Face iframe
    if (window.self !== window.top) {
      setIsInIframe(true);
    }
  }, []);

  // Application States
  const [chatId, setChatId] = useState<string>(uuidv4());
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 1. Fetch access token cleanly once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently({
        authorizationParams: {
          audience: import.meta.env.VITE_AUTH0_AUDIENCE || "https://api.smartcache.gateway",
        },
      })
        .then((token) => setAccessToken(token))
        .catch((err) => {
          if (err.error === "missing_refresh_token") {
            console.warn("Refresh token expired or invalid. Logging out user.");
            logout({ logoutParams: { returnTo: window.location.origin } });
          } else {
            console.error("Token retrieval failed:", err);
          }
        });
    }
  }, [isAuthenticated, getAccessTokenSilently, logout]);

  // 2. Fetch Sidebar History once token is available
  useEffect(() => {
    if (accessToken) {
      fetch(`${import.meta.env.DEV ? "http://localhost:8080/api/v1" : "/api/v1"}/chat/history`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      .then(res => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then(data => {
        // Defensive check: Only update state if the data is actually an array
        if (Array.isArray(data)) {
          setChatHistory(data);
        } else {
          setChatHistory([]); // Fallback to empty array
        }
      })
      .catch(err => {
        console.error("Failed to load history:", err);
        setChatHistory([]); // Prevent crashes on network failure
      });
    }
  }, [accessToken]);

  // Auto-scroll management
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // --- ACTIONS ---

  const loadPastChat = async (selectedChatId: string) => {
    if (!accessToken) return;
    
    // Stop any ongoing stream before switching chats
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }

    setChatId(selectedChatId);
    setIsLoading(true);
    try {
      const res = await fetch(`${import.meta.env.DEV ? "http://localhost:8080/api/v1" : "/api/v1"}/chat/history/${selectedChatId}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      
      // Convert database format to frontend Message format and strip tags
      const loadedMessages: Message[] = data.map((msg: any) => ({
        id: uuidv4(),
        role: msg.role.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: msg.content.replaceAll(/\[(CACHED|ROUTED:|🛡️|🏎️|🧠|🛠️|⚡)[^\]]+\]/gi, "").trim()
      }));
      setMessages(loadedMessages);
    } catch (err) {
      console.error("Failed to load messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setChatId(uuidv4());
    setMessages([]);
    setIsLoading(false);
  };

  const handleAbort = () => {
    if (abortController) {
      abortController.abort();
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleDeleteChat = async (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation(); // Prevents the sidebar button from triggering a load
    if (!window.confirm("Are you sure you want to delete this chat?")) return;

    try {
      await fetch(`${import.meta.env.DEV ? "http://localhost:8080/api/v1" : "/api/v1"}/chat/${idToDelete}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      // Remove it from the sidebar UI
      setChatHistory(prev => prev.filter(c => c.chat_id !== idToDelete));
      
      // If the user deleted the chat they are currently looking at, clear the screen
      if (chatId === idToDelete) {
        startNewChat();
      }
    } catch(err) {
      console.error("Failed to delete chat", err);
    }
  };

  const handleShareChat = async (e: React.MouseEvent, idToShare: string) => {
    e.stopPropagation();
    try {
      // 1. Fetch the full transcript for this specific chat
      const res = await fetch(`${import.meta.env.DEV ? "http://localhost:8080/api/v1" : "/api/v1"}/chat/history/${idToShare}`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const data = await res.json();
      
      // 2. Format it into a clean readable string
      let shareText = "🤖 SmartCache AI Gateway Conversation:\n\n";
      data.forEach((msg: any) => {
        const role = msg.role.toLowerCase() === 'user' ? 'You' : 'AI';
        const content = msg.content.replaceAll(/\[(CACHED|ROUTED:|🛡️|🏎️|🧠|🛠️|⚡)[^\]]+\]/gi, "").trim();
        shareText += `**${role}**:\n${content}\n\n---\n\n`;
      });

      // 3. Copy to clipboard
      await navigator.clipboard.writeText(shareText);
      
      // 4. Show a quick checkmark animation
      setCopiedId(idToShare);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to share chat", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const controller = new AbortController();
    setAbortController(controller);
    const userText = input.trim();
    setInput("");

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: userText,
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    
    const assistantMsgId = uuidv4();
    setMessages((prev) => [...prev, { id: assistantMsgId, role: "assistant", content: "" }]);

    try {
      await sendMessageStream(
        userText,
        chatId,
        accessToken || undefined,
        (currentText) => {
          setMessages((prev) => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.role === 'assistant') {
              return [
                ...prev.slice(0, -1),
                { ...lastMsg, content: currentText }
              ];
            }
            return prev;
          });
        },
        controller.signal
      );
    } catch (error: unknown) {
      if(error instanceof Error && error.name === "AbortError") {
        console.log("Message streaming aborted by user.");
        return; 
      }
      const errorMessageText = error instanceof Error ? error.message : "Error connecting to Gateway.";
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === assistantMsgId ? { ...msg, content: `**Error:** ${errorMessageText}` } : msg
        )
      );
    } finally {
      setIsLoading(false);
      setAbortController(null);
      
      // Refresh sidebar history after a new message is sent
      if (accessToken) {
        fetch(`${import.meta.env.DEV ? "http://localhost:8080/api/v1" : "/api/v1"}/chat/history`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        })
        .then(res => {
          if (!res.ok) throw new Error("History update failed");
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) setChatHistory(data);
        })
        .catch(err => console.log("Failed to refresh sidebar:", err));
      }
    }
  };

  // --- EARLY RETURNS (Loading, Errors, Unauthenticated) ---

  if (isInIframe) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center p-8 bg-zinc-800 rounded-xl border border-zinc-700 shadow-2xl max-w-md mx-4">
          <h2 className="text-xl font-bold text-white mb-4">Security Requirement</h2>
          <p className="text-zinc-400 mb-6 text-sm">
            Authentication requires this app to run in its own window, not inside the Hugging Face preview wrapper.
          </p>
          <a 
            href={window.location.href}
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition"
          >
            Launch Full Application
          </a>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading authentication...</p>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center max-w-md px-4">
          <p className="text-red-400 mb-2 font-semibold">Authentication Error</p>
          <p className="text-zinc-400 text-sm mb-6">{authError.message}</p>
          <button
            onClick={() => loginWithRedirect()} 
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition font-medium"
          >
            Retry Login
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center max-w-sm px-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mx-auto mb-6">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">SmartCache AI</h1>
          <p className="text-zinc-400 mb-8 text-sm">AI Semantic Gateway</p>
          
          <button
            onClick={() => loginWithRedirect()} 
            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition shadow-lg shadow-emerald-600/10"
          >
            Log In / Sign Up
          </button>
          
          <p className="text-zinc-500 text-xs mt-6 leading-relaxed">
            Running inside an iframe environment? If authentication redirects fail, make sure you are accessing the gateway directly via its direct URL.
          </p>
        </div>
      </div>
    );
  }

  // --- MAIN APP COMPONENT (Authenticated) ---
  return (
    <div className="flex h-screen bg-zinc-900 overflow-hidden font-sans text-zinc-100">
      
      {/* SIDEBAR */}
      <div className="w-64 flex-shrink-0 bg-zinc-950 border-r border-zinc-800 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-zinc-800">
          <button 
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600/10 text-emerald-400 border border-emerald-600/20 hover:bg-emerald-600/20 rounded-lg transition text-sm font-medium"
          >
            <span className="text-lg">+</span> New Chat
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">Recent Chats</h3>
          {chatHistory.length === 0 ? (
            <p className="text-xs text-zinc-600 px-2">No previous chats.</p>
          ) : (
            chatHistory.map((chat) => (
            <div 
              key={chat.chat_id}
              onClick={() => loadPastChat(chat.chat_id)}
              className={`group relative w-full flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer transition ${
                chatId === chat.chat_id 
                  ? "bg-zinc-800 text-zinc-100 font-medium shadow-sm" 
                  : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
              }`}
            >
              <div className="flex-1 truncate pr-14">
                💬 {chat.chat_title}
              </div>

              {/* ACTION BUTTONS (Hidden until hover) */}
              <div className="absolute right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                <button 
                  onClick={(e) => handleShareChat(e, chat.chat_id)}
                  className="p-1.5 bg-zinc-700 hover:bg-emerald-600 rounded-md text-zinc-300 hover:text-white transition"
                  title="Copy Transcript"
                >
                  {copiedId === chat.chat_id ? <Check size={14} /> : <Share size={14} />}
                </button>
                <button 
                  onClick={(e) => handleDeleteChat(e, chat.chat_id)}
                  className="p-1.5 bg-zinc-700 hover:bg-red-600 rounded-md text-zinc-300 hover:text-white transition"
                  title="Delete Chat"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
          )}
        </div>
      </div>

      {/* MAIN CHAT AREA */}
      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-10">
          <div className="flex items-center justify-between max-w-3xl mx-auto px-4 py-3 md:px-6 w-full">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 md:hidden">
                <span className="text-emerald-400 font-bold tracking-tighter text-sm">AI</span>
              </div>
              <h1 className="font-semibold text-zinc-100 tracking-tight">SmartCache</h1>
            </div>

            <div className="flex items-center gap-3">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name || "User profile"}
                  className="w-8 h-8 rounded-full border border-zinc-700"
                  title={user.email}
                />
              )}
              <button
                onClick={() => logout({ logoutParams: { returnTo: window.location.origin } })}
                className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition text-zinc-300"
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto scroll-smooth">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 space-y-4 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 flex items-center justify-center border border-zinc-700/50 mb-4">
                <span className="text-2xl">✨</span>
              </div>
              <h2 className="text-xl font-medium text-zinc-300">How can I help you today?</h2>
              <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
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

        <div className="flex-shrink-0 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent pt-4">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
            onStop={handleAbort} // PASSING THE ABORT FUNCTION TO CHAT INPUT
          />
        </div>
      </div>
    </div>
  );
}

export default App;