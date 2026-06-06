export interface ChatResponse {
  chatId: string;
  response: string;
}

<<<<<<< HEAD
/**
 * Sends a chat message to the Spring Boot backend with Auth0 JWT token.
 *
 * IMPORTANT:
 * - This function targets http://localhost:8080 (Spring Boot Resource Server)
 * - The JWT token is automatically retrieved by Auth0 with the 'audience' parameter
 * - RS256 signed JWTs are generated when 'audience' is set in Auth0Provider config
 *
 * @param prompt - The user's message text
 * @param chatId - Unique chat session identifier
 * @param jwt - RS256 JWT access token from Auth0 (retrieved via getAccessTokenSilently)
 * @returns ChatResponse with the AI gateway's response
 */
export const sendMessage = async (
  prompt: string,
  chatId?: string,
  jwt?: string,
): Promise<ChatResponse> => {
  // Use http://localhost:8080/api/v1 during local development, and relative path /api/v1 in production
  const baseURL = import.meta.env.DEV
    ? "http://localhost:8080/api/v1"
    : "/api/v1";
  const endpoint = `${baseURL}/chat`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Attach the RS256 JWT in the Authorization header for the OAuth2 Resource Server
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
=======
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
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
    body: JSON.stringify({ prompt, chatId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
<<<<<<< HEAD
    throw new Error(
      errorData.error || "Failed to communicate with AI provider.",
    );
=======
    throw new Error(errorData.error || 'Failed to communicate with AI provider.');
>>>>>>> 7863711792b8e6ad242e87e929f5c3ad2b21979d
  }

  return response.json();
};
