export interface ChatResponse {
  chatId: string;
  response: string;
}

// Keep your existing sendMessage for legacy calls
export const sendMessage = async (
  prompt: string,
  chatId?: string,
  jwt?: string,
): Promise<ChatResponse> => {
  const baseURL = import.meta.env.DEV ? "http://localhost:8080/api/v1" : "/api/v1";
  
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (jwt) headers.Authorization = `Bearer ${jwt}`;

  const response = await fetch(`${baseURL}/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ prompt, chatId }),
  });

  if (!response.ok) {
    throw new Error("Failed to communicate with AI provider.");
  }
  return response.json();
};

/**
 * Streams the AI response from the backend.
 * @param onChunk - Callback triggered every time a new token arrives
 */
export const sendMessageStream = async (
  prompt: string,
  chatId: string,
  jwt: string | undefined,
  onChunk: (text: string) => void
): Promise<string> => {
  const baseURL = import.meta.env.DEV ? "http://localhost:8080/api/v1" : "/api/v1";
  
  const response = await fetch(`${baseURL}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
    body: JSON.stringify({ prompt, chatId }),
  });

  if (!response.ok) throw new Error("Streaming failed");

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullText = "";

  if (!reader) throw new Error("Stream reader not available");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data:')) {
        // Remove the 'data:' prefix
        let content = line.slice(5);
        
        // Remove exactly ONE leading space per the SSE spec, preserving the rest
        if (content.startsWith(' ')) {
          content = content.slice(1);
        }
        
        // Ignore the [DONE] signal that some LLM APIs send at the stream's end
        if (content.trim() === '[DONE]') continue;
        
        if (content.length > 0) {
          // CRITICAL FIX: Convert escaped newlines back to actual line breaks.
          // We do NOT replace this with a space anymore!
          content = content.replace(/\\n/g, '\n'); 
          
          fullText += content;
        }
      }
    }
    
    // Performance optimization: Update the UI once per network chunk, 
    // not per individual line, to stop React from stuttering.
    if (fullText.length > 0) {
      onChunk(fullText);
    }
  }

  return fullText;
};