package com.smartcache.gateway.controller;

import com.smartcache.gateway.service.ChatService;

import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ChatController {

    private final ChatService chatService;

    public ChatController(ChatService chatService) {
        this.chatService = chatService;
    }

    @PostMapping({"/chat", "/chat/"})
    public ResponseEntity<Map<String, String>> handleChatRequest(
            @RequestBody ChatRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String prompt = request.prompt();
        String userId = jwt != null ? jwt.getSubject() : null;
        String chatId = (request.chatId() != null && !request.chatId().trim().isEmpty())
                        ? request.chatId()
                        : UUID.randomUUID().toString();

        if (prompt == null || prompt.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Prompt cannot be empty"));
        }

        if (userId == null || userId.isBlank()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid or missing JWT subject"));
        }

        try {
            String aiResponse = chatService.processChatMessage(chatId, prompt, userId);

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

    @PostMapping("/api/v1/chat")
    public ResponseEntity<?> handleChat(@RequestBody ChatRequest request) {
        
        // 1. Check the Zero-Latency Fast-Path First
        Optional<String> fastResponse = dynamicIntentRouter.checkFastPath(request.getMessage());
        
        if (fastResponse.isPresent()) {
            return ResponseEntity.ok(new ChatResponse(fastResponse.get()));
        }

        // 2. If it didn't match a rule, pass it to Groq/Gemini
        String aiResponse = aiService.callGroq(request.getMessage());
        return ResponseEntity.ok(new ChatResponse(aiResponse));
    }
}