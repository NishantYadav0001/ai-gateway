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
import reactor.core.scheduler.Schedulers;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import reactor.core.publisher.Flux;
import reactor.core.scheduler.Schedulers;

@Service
public class ChatService {

    private static final Logger logger = LoggerFactory.getLogger(ChatService.class);

    private final OpenAiChatModel groqModel;
    private final GoogleGenAiChatModel geminiModel;
    private final VectorStore vectorStore;
    private final JdbcTemplate jdbcTemplate;
    private final ApiUsageRepository apiUsageRepository;
    private final ChatClient groqChatClient;
    private final ChatClient geminiChatClient;

    public ChatService(OpenAiChatModel groqModel,
                       GoogleGenAiChatModel geminiModel,
                       VectorStore vectorStore,
                       JdbcTemplate jdbcTemplate,
                       ApiUsageRepository apiUsageRepository) {
        this.groqModel = groqModel;
        this.geminiModel = geminiModel;
        this.vectorStore = vectorStore;
        this.jdbcTemplate = jdbcTemplate;
        this.apiUsageRepository = apiUsageRepository;
        this.groqChatClient = ChatClient.builder(groqModel).build();
        this.geminiChatClient = ChatClient.builder(geminiModel).build();
    }

    private boolean isComplexRequest(String prompt) {
        String text = prompt.toLowerCase();
        return text.contains("code") || text.contains("java") || 
               text.contains("math") || text.contains("calculate") || 
               text.contains("system design") || text.contains("database");
    }

    private boolean isCacheableQuery(String prompt) {
        String text = prompt.toLowerCase().trim();
        String[] feedbackKeywords = {"wrong", "incorrect", "not what i asked", "try again", "fail", "inaccurate", "bad answer", "fix this"};
        for (String keyword : feedbackKeywords) {
            if (text.contains(keyword)) return false; 
        }
        return text.length() > 8;
    }

    private boolean requiresCognitiveEscalation(List<Message> history, String currentPrompt) {
        String text = currentPrompt.toLowerCase();
        String[] struggleKeywords = {"wrong", "incorrect", "not what i asked", "try again", "fail", "inaccurate"};
        
        for (String keyword : struggleKeywords) {
            if (text.contains(keyword)) return true; 
        }

        for (Message msg : history) {
            if (msg instanceof UserMessage && msg.getText().trim().equalsIgnoreCase(currentPrompt.trim())) {
                return true;
            }
        }
        return false;
    }

    public String processChatMessage(String chatId, String prompt, String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("JWT subject (userId) is required");
        }

        List<Message> history = new ArrayList<>();
        String selectSql = "SELECT message_role, message_content FROM chat_messages " +
                "WHERE chat_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10";

        jdbcTemplate.query(selectSql, (rs, rowNum) -> {
            String role = rs.getString("message_role");
            String content = rs.getString("message_content");
            if ("USER".equalsIgnoreCase(role)) {
                history.add(0, new UserMessage(content));
            } else if ("ASSISTANT".equalsIgnoreCase(role)) {
                history.add(0, new AssistantMessage(content));
            }
            return null;
        }, chatId, userId);

        boolean escalateToGemini = requiresCognitiveEscalation(history, prompt);
        boolean isComplex = isComplexRequest(prompt);
        boolean cacheable = isCacheableQuery(prompt);

        if (cacheable && !escalateToGemini) {
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
        }

        history.add(new UserMessage(prompt));
        ChatResponse chatResponse = null;
        String routingTag = "";

        // ==========================================
        // ROUTING ENGINE WITH FAILSAFE RESILIENCE
        // ==========================================
        if (escalateToGemini) {
            try {
                routingTag = "[🧠 ESCALATED: gemini-3.5-flash]";
                chatResponse = geminiChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                        .messages(history)
                        .options(GoogleGenAiChatOptions.builder().model("gemini-3.5-flash").build())
                        .call()
                        .chatResponse();
            } catch (Exception e) {
                logger.warn("Gemini API Overloaded (503). Triggering Fallback to Groq Llama 3.3.");
                // FAILSAFE: If Gemini is down, force it to use the Heavy Groq model
                routingTag = "[🛡️ FAILSAFE ROUTED: Groq Llama 3.3 Heavy Brain]";
                chatResponse = groqChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                        .messages(history)
                        .options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build())
                        .call()
                        .chatResponse();
            }
        } else if (isComplex) {
            routingTag = "[🛠️ ROUTED: Groq Llama 3.3 Heavy Brain]";
            chatResponse = groqChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                    .messages(history)
                    .options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build())
                        .call()
                    .chatResponse();
        } else {
            routingTag = "[🏎️ ROUTED: Groq Llama 3.1 Fast Brain]";
            chatResponse = groqChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                    .messages(history)
                    .options(OpenAiChatOptions.builder().model("llama-3.1-8b-instant").build())
                        .call()
                    .chatResponse();
        }

        String responseText = chatResponse.getResult().getOutput().getText();
        Usage usage = chatResponse.getMetadata() != null ? chatResponse.getMetadata().getUsage() : null;
        int promptTokens = usage != null && usage.getPromptTokens() != null ? usage.getPromptTokens() : 0;
        int completionTokens = usage != null && usage.getCompletionTokens() != null ? usage.getCompletionTokens() : 0;

        saveUsage(userId, promptTokens, completionTokens);

        String insertSql = "INSERT INTO chat_messages (chat_id, user_id, message_role, message_content) VALUES (?, ?, ?, ?)";
        jdbcTemplate.update(insertSql, chatId, userId, "USER", prompt);
        jdbcTemplate.update(insertSql, chatId, userId, "ASSISTANT", responseText);

        responseText = responseText + "\n\n" + routingTag;

        if (cacheable && !escalateToGemini) {
            Document doc = new Document(prompt, Map.of(
                    "answer", responseText,
                    "userId", userId,
                    "chatId", chatId));
            vectorStore.add(List.of(doc));
        }

        return responseText;
    }

    public Flux<String> processChatMessageStream(String chatId, String prompt, String userId) {
        if (userId == null || userId.isBlank()) {
            throw new IllegalArgumentException("JWT subject (userId) is required");
        }

        List<Message> history = new ArrayList<>();
        String selectSql = "SELECT message_role, message_content FROM chat_messages " +
                "WHERE chat_id = ? AND user_id = ? ORDER BY id DESC LIMIT 10";

        jdbcTemplate.query(selectSql, (rs, rowNum) -> {
            String role = rs.getString("message_role");
            String content = rs.getString("message_content");
            if ("USER".equalsIgnoreCase(role)) {
                history.add(0, new UserMessage(content));
            } else if ("ASSISTANT".equalsIgnoreCase(role)) {
                history.add(0, new AssistantMessage(content));
            }
            return null;
        }, chatId, userId);

        boolean escalateToGemini = requiresCognitiveEscalation(history, prompt);
        boolean isComplex = isComplexRequest(prompt);
        boolean cacheable = isCacheableQuery(prompt);

        if (cacheable && !escalateToGemini) {
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
                String cachedResp = similarDocs.get(0).getMetadata().get("answer").toString() + "\n\n[⚡ CACHED: Pinecone Vector Database]";
                return Flux.just(cachedResp);
            }
        }

        history.add(new UserMessage(prompt));
        Flux<String> chatResponseStream = null;
        String routingTag = "";

        if (escalateToGemini) {
            try {
                routingTag = "\n\n[🧠 ESCALATED: gemini-3.5-flash]";
                chatResponseStream = geminiChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                        .messages(history)
                        .options(GoogleGenAiChatOptions.builder().model("gemini-3.5-flash").build())
                        .stream()
                        .content();
            } catch (Exception e) {
                logger.warn("Gemini API Overloaded (503). Triggering Fallback to Groq Llama 3.3.");
                routingTag = "\n\n[🛡️ FAILSAFE ROUTED: Groq Llama 3.3 Heavy Brain]";
                chatResponseStream = groqChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                        .messages(history)
                        .options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build())
                        .stream()
                        .content();
            }
        } else if (isComplex) {
            routingTag = "\n\n[🛠️ ROUTED: Groq Llama 3.3 Heavy Brain]";
            chatResponseStream = groqChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                    .messages(history)
                    .options(OpenAiChatOptions.builder().model("llama-3.3-70b-versatile").build())
                    .stream()
                    .content();
        } else {
            routingTag = "\n\n[🏎️ ROUTED: Groq Llama 3.1 Fast Brain]";
            chatResponseStream = groqChatClient.prompt()
                        .system("You are the SmartCache AI Semantic Gateway, a high-performance technical routing assistant. 1. CONCISENESS: Never use filler text. Jump straight to the technical answer. 2. FORMATTING: Use Markdown. 3. PERSONALITY: Professional and direct. 4. LENGTH: Keep responses as short as possible while remaining accurate.")
                    .messages(history)
                    .options(OpenAiChatOptions.builder().model("llama-3.1-8b-instant").build())
                    .stream()
                    .content();
        }

        final String finalRoutingTag = routingTag;

        return chatResponseStream
                .concatWith(Flux.just(finalRoutingTag))
                .publishOn(Schedulers.boundedElastic()) // CRITICAL: Moves downstream processing off the main reactive thread
                .publish(flux -> {
                    StringBuilder fullResponse = new StringBuilder();
                    return flux.doOnNext(fullResponse::append)
                               .doOnComplete(() -> {
                                   // Now this runs on a background thread pool, not blocking the response stream
                                   saveToDatabase(chatId, userId, prompt, fullResponse.toString(), cacheable, escalateToGemini);
                               });
                });
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
}
