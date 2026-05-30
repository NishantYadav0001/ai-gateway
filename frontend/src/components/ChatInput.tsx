import React, { useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

export function ChatInput({ input, setInput, onSubmit, isLoading }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      // Limit max height to roughly 6 lines (~150px)
      const newHeight = Math.min(textarea.scrollHeight, 150);
      textarea.style.height = `${newHeight}px`;
      
      // Auto-scroll inside textarea if content exceeds max-height
      textarea.style.overflowY = textarea.scrollHeight > 150 ? 'auto' : 'hidden';
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        />
        
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className={cn(
            "p-2 rounded-lg flex-shrink-0 transition-all mb-0.5",
            input.trim() && !isLoading
              ? "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
              : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Send size={18} className={input.trim() ? "translate-x-px" : ""} />
          )}
        </button>
      </form>
      <div className="text-center mt-3 text-xs text-zinc-500 font-medium tracking-wide">
        Powered by SmartCache & Llama Models
      </div>
    </div>
  );
}
