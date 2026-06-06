import React, { useState, useRef, useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { v4 as uuidv4 } from "uuid";
import { ChatMessage, type Message } from "./components/ChatMessage";
import { ChatInput } from "./components/ChatInput";
import { sendMessage } from "./api";

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatId] = useState<string>(uuidv4());
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get access token when authenticated with production-grade error handling
  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently({
        authorizationParams: {
          audience:
            import.meta.env.VITE_AUTH0_AUDIENCE ||
            "https://api.smartcache.gateway",
        },
      })
        .then((token) => setAccessToken(token))
        .catch((err) => {
          // Handle missing refresh token - user needs to re-authenticate
          if (err.error === "missing_refresh_token") {
            console.warn("Refresh token expired or invalid. Logging out user.");
            logout({ logoutParams: { returnTo: window.location.origin } });
          } else {
            // Log other token retrieval errors but don't logout automatically
            console.error("Token retrieval failed:", {
              error: err.error,
              errorDescription: err.error_description,
              message: err.message,
            });
          }
        });
    }
  }, [isAuthenticated, getAccessTokenSilently, logout]);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");

    // Add User message
    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: userText,
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);

    try {
      const response = await sendMessage(
        userText,
        chatId,
        accessToken || undefined,
      );

      const assistantMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: response.response,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: unknown) {
      const errorMessageText =
        error instanceof Error
          ? error.message
          : "Something went wrong while connecting to the AI Gateway.";
      const errorMessage: Message = {
        id: uuidv4(),
        role: "assistant",
        content: `**Error:** ${errorMessageText}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state while Auth0 is initializing
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

  // Show error state if Auth0 has an error
  if (authError) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center max-w-md">
          <p className="text-red-400 mb-4">Authentication Error</p>
          <p className="text-zinc-400 mb-6">{authError.message}</p>
          <button
            onClick={() => loginWithRedirect()}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white transition"
          >
            Retry Login
          </button>
        </div>
      </div>
    );
  }

  // Show login/signup screen if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-900">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mx-auto mb-6">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">SmartCache</h1>
          <p className="text-zinc-400 mb-8">AI Semantic Gateway</p>
          <div className="space-y-3">
            <button
              onClick={() => loginWithRedirect()}
              className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-white font-medium transition"
            >
              Login
            </button>
            <button
              onClick={() =>
                loginWithPopup({
                  authorizationParams: { screen_hint: "signup" },
                })
              }
              className="w-full px-6 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white font-medium transition border border-zinc-700"
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main app UI (authenticated)
  return (
    <div className="flex flex-col h-screen bg-zinc-900 overflow-hidden font-sans text-zinc-100">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md z-10">
        <div className="flex items-center justify-between max-w-3xl mx-auto px-4 py-3 md:px-6 w-full">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
              <span className="text-emerald-400 font-bold tracking-tighter">
                AI
              </span>
            </div>
            <h1 className="font-semibold text-zinc-100 tracking-tight">
              SmartCache
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-8 h-8 rounded-full"
                  title={user.email}
                />
              </div>
            )}
            <button
              onClick={() =>
                logout({ logoutParams: { returnTo: window.location.origin } })
              }
              className="px-3 py-1 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
            >
              Logout
            </button>
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
            <h2 className="text-xl font-medium text-zinc-300">
              How can I help you today?
            </h2>
            <p className="max-w-sm text-sm leading-relaxed">
              Experience lightning-fast responses with our intelligent caching
              layer and dynamic Llama model routing.
            </p>
            {user && (
              <p className="text-xs text-zinc-600 mt-4">
                Logged in as {user.email}
              </p>
            )}
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
      {isAuthenticated && (
        <div className="flex-shrink-0 bg-gradient-to-t from-zinc-900 via-zinc-900 to-transparent pt-4">
          <ChatInput
            input={input}
            setInput={setInput}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>
      )}
    </div>
  );
}

export default App;
