export interface ChatResponse {
  chatId: string;
  response: string;
}

export const sendMessage = async (
  prompt: string,
  chatId?: string
): Promise<ChatResponse> => {
  // Use Vite proxy in development, or absolute URL in production.
  // We point to /api/v1/chat because that's what ChatController maps to.
  const baseUrl = import.meta.env.VITE_API_URL || '';
  const endpoint = `${baseUrl}/api/v1/chat`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, chatId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to communicate with AI provider.');
  }

  return response.json();
};
