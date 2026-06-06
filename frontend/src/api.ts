export interface ChatResponse {
  chatId: string;
  response: string;
}

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
    body: JSON.stringify({ prompt, chatId }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error || "Failed to communicate with AI provider.",
    );
  }

  return response.json();
};
