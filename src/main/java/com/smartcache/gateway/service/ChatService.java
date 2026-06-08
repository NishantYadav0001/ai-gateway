package com.smartcache.gateway.service;

import com.smartcache.gateway.model.ApiUsage;
import com.smartcache.gateway.repository.ApiUsageRepository;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.metadata.Usage;
import org.springframework.ai.document.Document;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.google.genai.GoogleGenAiChatModel;
import org.springframework.ai.google.genai.GoogleGenAiChatOptions;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.vectorstore.filter.Filter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class ChatService {

    private static final Logger logger = LoggerFactory.getLogger(ChatService.class);

    private static final String SYSTEM_PROMPT = """
            You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 
            Follow these strict output rules:
            1. CONCISENESS: Zero filler text. Do not say "Here is the answer" or "I can help." Jump straight to the technical solution.
            2. FORMATTING: Use strict Markdown. Use bold (**text**) for definitions, bullet points (-) for lists, and backticks (`) for code. 
            3. SPACING & STREAMING: Use single line breaks between paragraphs and list items. Do NOT use double empty lines or massive vertical gaps. Maintain a tight, readable structure.
            4. TONE: Professional, direct, and highly technical.""";

    private final OpenAiChatModel groqModel;
    private final GoogleGenAiChatModel geminiModel;
    private final VectorStore vectorStore;
    private final JdbcTemplate jdbcTemplate;
    private final ApiUsageRepository apiUsageRepository;
    private final ChatClient groqChatClient;
    private final ChatClient geminiChatClient;

    public ChatService(OpenAiChatModel groqModel, GoogleGenAiChatModel geminiModel,
                       VectorStore vectorStore, JdbcTemplate jdbcTemplate,
                       ApiUsageRepository apiUsageRepository) {
        this.groqModel = groqModel;
        this.geminiModel = geminiModel;
        this.vectorStore = vectorStore;
        this.jdbcTemplate = jdbcTemplate;
        this.apiUsageRepository = apiUsageRepository;
        this.groqChatClient = ChatClient.builder(groqModel).build();
        this.geminiChatClient = ChatClient.builder(geminiModel).build();
    }

    // --- STATIC SETS FOR INTELLIGENT ROUTING ---
    private static final Set<String> COMPLEX_WORDS = Set.of(
        "code", "java", "python", "sql", "math", "calculate", "database", 
        "algorithm", "debug", "optimize", "architecture", "deployment", "frontend",
        "backend", "api", "docker", "kubernetes", "query", "script"
    );

    private static final Set<String> COMPLEX_PHRASES = Set.of(
        "system design", "spring boot", "react native", "machine learning", "data structures"
    );

    private static final Set<String> ESCALATION_WORDS = Set.of(
        "wrong", "incorrect", "fail", "inaccurate", "bad", "broken", 
        "useless", "ignore", "stop", "stupid", "error", "terrible"
    );

    private static final Set<String> ESCALATION_PHRASES = Set.of(
        "not what i asked", "try again", "fix this", "didn't work", 
        "do it right", "you misunderstood", "read my prompt"
    );

    // ==========================================
    // 1. REUSABLE HELPER METHODS (DRY Principle)
    // ==========================================

    private List<Message> loadChatHistory(String chatId, String userId) {
        List<Message> history = new ArrayList<>();
        String selectSql = "SELECT message_role, message_content FROM chat_messages " +
                "WHERE chat_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10";

        jdbcTemplate.query(selectSql, (rs, rowNum) -> {
            String role = rs.getString("message_role");
            String content = rs.getString("message_content");
            // Strip out internal tags so LLMs don't mimic them
            String cleanContent = content.replaceAll("\\[(CACHED|ROUTED:|🛡️|🏎️|🧠|🛠️|⚡)[^\\]]+\\]", "").trim();

            if ("USER".equalsIgnoreCase(role)) {
                history.add(0, new UserMessage(cleanContent));
            } else if ("ASSISTANT".equalsIgnoreCase(role)) {
                history.add(0, new AssistantMessage(cleanContent));
            }
            return null;
        }, chatId, userId);
        
        return history;
    }

    private String checkVectorCache(String prompt, String userId) {
        SearchRequest searchRequest = SearchRequest.builder()
                .query(prompt)
                .topK(1)
                .similarityThreshold(0.85)
                .filterExpression(new Filter.Expression(
                        Filter.ExpressionType.EQ,
                        new Filter.Key("userId"),
                        new Filter.Value(userId)))
                .build();

        List<Document> similarDocs = vectorStore.similaritySearch(searchRequest);
        if (!similarDocs.isEmpty()) {
            return similarDocs.get(0).getMetadata().get("answer").toString() + "\n\n[⚡ CACHED: Pinecone Vector Database]";
        }
        return null;
    }

    private void saveToDatabase(String chatId, String userId, String prompt, String responseText, boolean cacheable, boolean escalate) {
        String insertSql = "INSERT INTO chat_messages (chat_id, user_id, message_role, message_content) VALUES (?, ?, ?, ?)";
        jdbcTemplate.update(insertSql, chatId, userId, "USER", prompt);
        jdbcTemplate.update(insertSql, chatId, userId, "ASSISTANT", responseText);

        if (cacheable && !escalate) {
            Document doc = new Document(prompt, Map.of(
                    "answer", responseText, "userId", userId, "chatId", chatId));
            vectorStore.add(List.of(doc));
        }
    }

    private void saveUsage(String userId, int promptTokens, int completionTokens) {
        apiUsageRepository.save(new ApiUsage(userId, promptTokens, completionTokens));
    }

    // --- EVALUATION LOGIC ---
    
    private boolean isComplexRequest(String prompt) {
        String lowerPrompt = prompt.toLowerCase().trim();
        String[] words = lowerPrompt.split("\\W+"); 
        for (String word : words) { if (COMPLEX_WORDS.contains(word)) return true; }
        for (String phrase : COMPLEX_PHRASES) { if (lowerPrompt.contains(phrase)) return true; }
        return false;
    }

    private boolean isCacheableQuery(String prompt) {
        String lowerPrompt = prompt.toLowerCase().trim();
        if (lowerPrompt.length() <= 8) return false;
        String[] words = lowerPrompt.split("\\W+");
        for (String word : words) { if (ESCALATION_WORDS.contains(word)) return false; }
        for (String phrase : ESCALATION_PHRASES) { if (lowerPrompt.contains(phrase)) return false; }
        return true;
    }

    private boolean requiresCognitiveEscalation(List<Message> history, String currentPrompt) {
        String lowerPrompt = currentPrompt.toLowerCase().trim();
        String[] words = lowerPrompt.split("\\W+");
        for (String word : words) { if (ESCALATION_WORDS.contains(word)) return true; }
        for (String phrase : ESCALATION_PHRASES) { if (lowerPrompt.contains(phrase)) return true; }

        if (history != null && !history.isEmpty()) {
            for (int i = history.size() - 1; i >= 0; i--) {
                Message msg = history.get(i);
                if (msg instanceof UserMessage) {
                    return msg.getText().trim().equalsIgnoreCase(currentPrompt.trim());
                }
            }
        }
        return false;
    }

    // ==========================================
    // 2. THE MAIN PROCESSING ENDPOINTS
    // ==========================================

    public String processChatMessage(String chatId, String prompt, String userId) {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("JWT subject (userId) is required");

        List<Message> history = loadChatHistory(chatId, userId);
        boolean escalateToGemini = requiresCognitiveEscalation(history, prompt);
        boolean isComplex = isComplexRequest(prompt);
        boolean cacheable = isCacheableQuery(prompt);

        if (cacheable && !escalateToGemini) {
            String cachedResponse = checkVectorCache(prompt, userId);
            if (cachedResponse != null) return cachedResponse;
        }

        history.add(new UserMessage(prompt));
        ChatResponse chatResponse = null;
        String routingTag = "";

        if (escalateToGemini) {
            try {
                routingTag = "\n\n[🧠 ESCALATED: gemini-3.5-flash]";
                chatResponse = geminiChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(GoogleGenAiChatOptions.builder().model("gemini-3.5-flash").build()).call().chatResponse();
            } catch (Exception e) {
                logger.warn("Gemini API Overloaded (503). Triggering Fallback to Groq Llama 3.3.");
                routingTag = "\n\n[🛡️ FAILSAFE ROUTED: Groq Llama 3.3 Heavy Brain]";
                chatResponse = groqChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build()).call().chatResponse();
            }
        } else if (isComplex) {
            routingTag = "\n\n[🛠️ ROUTED: Groq Llama 3.3 Heavy Brain]";
            chatResponse = groqChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build()).call().chatResponse();
        } else {
            routingTag = "\n\n[🏎️ ROUTED: Groq Llama 3.1 Fast Brain]";
            chatResponse = groqChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(OpenAiChatOptions.builder().model("llama-3.1-8b-instant").build()).call().chatResponse();
        }

        String responseText = chatResponse.getResult().getOutput().getText();
        Usage usage = chatResponse.getMetadata() != null ? chatResponse.getMetadata().getUsage() : null;
        saveUsage(userId, usage != null && usage.getPromptTokens() != null ? usage.getPromptTokens() : 0, usage != null && usage.getCompletionTokens() != null ? usage.getCompletionTokens() : 0);

        responseText += routingTag;
        saveToDatabase(chatId, userId, prompt, responseText, cacheable, escalateToGemini);

        return responseText;
    }

    public Flux<String> processChatMessageStream(String chatId, String prompt, String userId) {
        if (userId == null || userId.isBlank()) throw new IllegalArgumentException("JWT subject (userId) is required");

        List<Message> history = loadChatHistory(chatId, userId);
        boolean escalateToGemini = requiresCognitiveEscalation(history, prompt);
        boolean isComplex = isComplexRequest(prompt);
        boolean cacheable = isCacheableQuery(prompt);

        if (cacheable && !escalateToGemini) {
            String cachedResponse = checkVectorCache(prompt, userId);
            if (cachedResponse != null) return Flux.just(cachedResponse);
        }

        history.add(new UserMessage(prompt));
        Flux<String> chatResponseStream;
        String routingTag = "";

        if (escalateToGemini) {
            try {
                routingTag = "\n\n[🧠 ESCALATED: gemini-3.5-flash]";
                chatResponseStream = geminiChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(GoogleGenAiChatOptions.builder().model("gemini-3.5-flash").build()).stream().content();
            } catch (Exception e) {
                logger.warn("Gemini API Overloaded (503). Triggering Fallback to Groq Llama 3.3.");
                routingTag = "\n\n[🛡️ FAILSAFE ROUTED: Groq Llama 3.3 Heavy Brain]";
                chatResponseStream = groqChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build()).stream().content();
            }
        } else if (isComplex) {
            routingTag = "\n\n[🛠️ ROUTED: Groq Llama 3.3 Heavy Brain]";
            chatResponseStream = groqChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build()).stream().content();
        } else {
            routingTag = "\n\n[🏎️ ROUTED: Groq Llama 3.1 Fast Brain]";
            chatResponseStream = groqChatClient.prompt().system(SYSTEM_PROMPT).messages(history).options(OpenAiChatOptions.builder().model("llama-3.1-8b-instant").build()).stream().content();
        }

        final String finalRoutingTag = routingTag;

        return chatResponseStream
                .concatWith(Flux.just(finalRoutingTag))
                .publishOn(Schedulers.boundedElastic())
                .publish(flux -> {
                    StringBuilder fullResponse = new StringBuilder();
                    return flux.doOnNext(fullResponse::append)
                               .doOnComplete(() -> saveToDatabase(chatId, userId, prompt, fullResponse.toString(), cacheable, escalateToGemini));
                });
    }
}