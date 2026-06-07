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
  let lastUpdate = 0;

  if (!reader) throw new Error("Stream reader not available");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    
    // Only update the UI every 50ms to keep it smooth and snappy
    if (Date.now() - lastUpdate > 50) {
        onChunk(fullText);
        lastUpdate = Date.now();
    }
  }
  onChunk(fullText); // Final update

  return fullText;
};