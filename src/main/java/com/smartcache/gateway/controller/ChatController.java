package com.smartcache.gateway.controller;

import com.smartcache.gateway.service.ChatService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ChatController {

    private final ChatService chatService;

    // Spring Boot automatically injects the ChatService here
    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping({"/chat", "/chat/"})
    public ResponseEntity<Map<String, String>> handleChatRequest(@RequestBody ChatRequest request) {
        
        String prompt = request.prompt();
        String chatId = (request.chatId() != null && !request.chatId().trim().isEmpty()) 
                        ? request.chatId() 
                        : UUID.randomUUID().toString();
        
        if (prompt == null || prompt.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Prompt cannot be empty"));
        }

        try {
            // Hand the request off to the Service layer
            String aiResponse = chatService.processChatMessage(chatId, prompt);

            return ResponseEntity.ok(Map.of(
                "chatId", chatId,
                "response", aiResponse
            ));

        } catch (Exception e) {
            e.printStackTrace(); 
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to communicate with AI provider. Please try again later."));
        }
    }

    public record ChatRequest(String chatId, String prompt) {}
}