package com.smartcache.gateway.service;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.UserMessage;
import org.springframework.ai.document.Document;
import org.springframework.ai.vectorstore.SearchRequest;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
public class ChatService {

    private final ChatClient chatClient;
    private final VectorStore vectorStore;
    private final JdbcTemplate jdbcTemplate; // Native SQL execution tool

    public ChatService(ChatClient.Builder chatClientBuilder, VectorStore vectorStore, JdbcTemplate jdbcTemplate) {
        this.vectorStore = vectorStore;
        this.jdbcTemplate = jdbcTemplate;
        this.chatClient = chatClientBuilder.build();
    }

    private boolean isComplexRequest(String prompt) {
        String text = prompt.toLowerCase();
        return text.contains("code") || 
               text.contains("java") || 
               text.contains("math") || 
               text.contains("calculate") || 
               text.contains("system design") ||
               text.contains("database");
    }

    public String processChatMessage(String chatId, String prompt) {
        // 1. SEMANTIC CACHE LOOKUP
        List<Document> similarDocs = vectorStore.similaritySearch(
            SearchRequest.builder()
                .query(prompt)
                .topK(1)
                .similarityThreshold(0.85)
                .build()
        );

        if (!similarDocs.isEmpty()) {
            return similarDocs.get(0).getMetadata().get("answer").toString() + " [CACHED]";
        }

        // 2. CONTEXT RETRIEVAL: Load the last 10 historical messages from our SQL database
        List<Message> history = new ArrayList<>();
        String selectSql = "SELECT message_role, message_content FROM chat_messages WHERE chat_id = ? ORDER BY id DESC LIMIT 10";
        
        jdbcTemplate.query(selectSql, (rs, rowNum) -> {
            String role = rs.getString("message_role");
            String content = rs.getString("message_content");
            if ("USER".equalsIgnoreCase(role)) {
                history.add(0, new UserMessage(content));
            } else if ("ASSISTANT".equalsIgnoreCase(role)) {
                history.add(0, new AssistantMessage(content));
            }
            return null;
        }, chatId);

        history.add(new UserMessage(prompt));

        // 3. ROUTING LOGIC
        boolean isComplex = isComplexRequest(prompt);
        String routingTag = isComplex ? "[ROUTED: Llama 70B Heavy Brain]" : "[ROUTED: Llama 8B Fast Brain]";
        
        String dynamicSystemPrompt = isComplex 
            ? "You are an Expert Java Software Engineer. Provide highly detailed, technical, and professional answers. Use your chat history context."
            : "You are a fast, casual AI assistant. Give short, friendly, and concise answers. Use your chat history context.";

        String targetModel = isComplex ? "llama-3.3-70b-versatile" : "llama-3.1-8b-instant";

        // 4. CALL AI WITH COMBINED CONTEXT WINDOW
        String responseText = this.chatClient.prompt()
                .system(dynamicSystemPrompt)
                
                .messages(history)
                .options(OpenAiChatOptions.builder()
                    .model(targetModel)
                    .build())
                .call()
                .content();

        // 5. STATE PERSISTENCE: Save both the new question and the answer to our database file
        String insertSql = "INSERT INTO chat_messages (chat_id, message_role, message_content) VALUES (?, ?, ?)";
        jdbcTemplate.update(insertSql, chatId, "USER", prompt);
        jdbcTemplate.update(insertSql, chatId, "ASSISTANT", responseText);

        responseText = responseText + "\n\n" + routingTag;

        // 6. STORE IN SEMANTIC CACHE
        Document doc = new Document(prompt, Map.of("answer", responseText));
        vectorStore.add(List.of(doc));

        return responseText;
    }
}

