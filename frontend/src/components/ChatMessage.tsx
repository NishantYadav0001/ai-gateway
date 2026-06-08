import { User, Bot } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import ReactMarkdown from "react-markdown";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type MessageRole = "user" | "assistant";

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
}

interface ChatMessageProps {
  message: Message;
}

const TAG_REGEX = /\[(CACHED|ROUTED:\s*[^\]]+|🛡️[^\]]+|🏎️[^\]]+|🧠[^\]]+|🛠️[^\]]+|⚡[^\]]+)\]/gi;

function parseContent(text: string) {
  let cleanText = text;
  const tags: string[] = [];

  // Extract tags and remove them from the main text
  const matches = [...text.matchAll(TAG_REGEX)];
  matches.forEach((match) => {
    tags.push(match[1]); // push the inner content of the tag without brackets
    cleanText = cleanText.replace(match[0], "");
  });

  return { cleanText: cleanText.trim(), tags };
}

function getTagColor(tag: string) {
  const upperTag = tag.toUpperCase();
  if (upperTag.includes("CACHED"))
    return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
  if (upperTag.includes("70B") || upperTag.includes("HEAVY"))
    return "bg-purple-500/20 text-purple-300 border-purple-500/30";
  if (upperTag.includes("8B") || upperTag.includes("FAST"))
    return "bg-blue-500/20 text-blue-300 border-blue-500/30";
  if (upperTag.includes("GEMINI"))
    return "bg-indigo-500/20 text-indigo-300 border-indigo-500/30";
  return "bg-zinc-500/20 text-zinc-300 border-zinc-500/30"; // fallback
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const { cleanText, tags } = isUser
    ? { cleanText: message.content, tags: [] }
    : parseContent(message.content);

  return (
    <div
      className={cn(
        "flex w-full px-4 py-6 md:px-6",
        isUser ? "bg-zinc-900" : "bg-zinc-800/50",
      )}
    >
      <div className="flex w-full max-w-3xl mx-auto gap-4 md:gap-6">
        {/* Avatar */}
        <div
          className={cn(
            "flex items-center justify-center w-8 h-8 rounded-md shrink-0 border",
            isUser
              ? "bg-zinc-800 border-zinc-700 text-zinc-300"
              : "bg-teal-900 border-teal-700 text-teal-300",
          )}
        >
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>

        {/* Message Body */}
        <div className="flex flex-col gap-3 min-w-0 flex-1">
          {/* THE UPGRADE: ReactMarkdown handles the parsed cleanText */}
          <div className="min-w-0 break-words whitespace-pre-wrap text-sm leading-relaxed text-zinc-300 font-sans">
            <ReactMarkdown
              components={{
                /* We use _node to tell the terminal linter to ignore the unused variable */
                p: ({ node: _node, ...props }) => <p className="mb-3 last:mb-0" {...props} />,
                ul: ({ node: _node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-1.5" {...props} />,
                ol: ({ node: _node, ...props }) => <ol className="list-decimal pl-5 mb-4 space-y-1.5" {...props} />,
                li: ({ node: _node, ...props }) => <li className="marker:text-teal-500 pl-1" {...props} />,
                strong: ({ node: _node, ...props }) => <strong className="font-semibold text-zinc-100" {...props} />,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
                code: ({ node: _node, inline, className, children, ...props }: any) => {
                  return inline ? (
                    <code className="bg-zinc-800/80 text-teal-300 px-1.5 py-0.5 rounded text-xs border border-zinc-700/50" {...props}>
                      {children}
                    </code>
                  ) : (
                    <pre className="bg-zinc-950 p-4 rounded-xl overflow-x-auto mb-4 border border-zinc-800 shadow-inner">
                      <code className="text-zinc-300 text-xs font-mono" {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                },
              }}
            >
              {cleanText}
            </ReactMarkdown>
          </div>

          {/* Tags (Rendered exactly as you designed them) */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded-full border font-medium tracking-wide shadow-sm",
                    getTagColor(tag),
                  )}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}