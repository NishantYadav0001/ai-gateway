import React, { useRef, useEffect } from "react";
import { Send, Square } from "lucide-react"; // Swapped Loader2 for Square icon
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop?: () => void; // NEW: Added the onStop prop
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  onStop,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      // Limit max height to roughly 6 lines (~150px)
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;

      // Auto-scroll inside textarea if content exceeds max-height
      textarea.style.overflowY =
        textarea.scrollHeight > 150 ? "auto" : "hidden";
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        onSubmit(e);
      }
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 pb-6 pt-2">
      <form
        onSubmit={onSubmit}
        className="relative flex items-end gap-2 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 shadow-sm focus-within:ring-1 focus-within:ring-zinc-600 focus-within:border-zinc-600 transition-all"
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Send a message to AI Gateway..."
          disabled={isLoading}
          rows={1}
          className={cn(
            "w-full max-h-[150px] bg-transparent text-zinc-100 placeholder:text-zinc-500",
            "resize-none outline-none focus:outline-none border-none py-1.5",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        />

        {/* DYNAMIC BUTTON: Switches between Send and Stop */}
        {isLoading ? (
          <button
            type="button" // Important: type="button" prevents accidental form submission
            onClick={onStop}
            className={cn(
              "p-2 rounded-lg flex-shrink-0 transition-all mb-0.5",
              "bg-zinc-700 text-zinc-300 hover:bg-zinc-600 hover:text-white"
            )}
            title="Stop generating"
          >
            <Square size={16} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className={cn(
              "p-2 rounded-lg flex-shrink-0 transition-all mb-0.5",
              input.trim()
                ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                : "bg-zinc-800 text-zinc-600 cursor-not-allowed",
            )}
            title="Send message"
          >
            <Send size={18} className={input.trim() ? "translate-x-px" : ""} />
          </button>
        )}
      </form>
      <div className="text-center mt-3 text-xs text-zinc-500 font-medium tracking-wide">
        This is an AI-powered Gateway. It can make mistakes, so please verify the information it provides. Do not share sensitive information with it.
      </div>
    </div>
  );
}