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
  let buffer = ""; // Crucial: Buffers chunks that get cut off mid-network transfer

  if (!reader) throw new Error("Stream reader not available");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Add the new network chunk to our buffer
    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events (which are separated by double newlines \n\n)
    let eventEndIndex;
    while ((eventEndIndex = buffer.indexOf('\n\n')) >= 0) {
      // Extract the single event and remove it from the buffer
      const event = buffer.slice(0, eventEndIndex);
      buffer = buffer.slice(eventEndIndex + 2);

      const lines = event.split('\n');
      let eventData = "";

      for (const line of lines) {
        if (line.startsWith('data:')) {
          let content = line.slice(5);
          // Remove exactly ONE leading space per the SSE specification
          // if (content.startsWith(' ')) {
          //   content = content.slice(1);
          // }
          // Re-join multi-line data within the same event
          if (eventData.length > 0) {
            eventData += '\n';
          }
          eventData += content;
        }
      }

      if (eventData.trim() === '[DONE]') continue;

      if (eventData.length > 0) {
        // Convert any escaped newlines and append
        eventData = eventData.replace(/\\n/g, '\n');
        fullText += eventData;
      } else if (event.includes('data:')) {
        // If the AI specifically generated an empty line break, respect it exactly once
        fullText += '\n';
      }
    }

    // Update the UI smoothly
    if (fullText.length > 0) {
      onChunk(fullText);
    }
  }

  return fullText;
};