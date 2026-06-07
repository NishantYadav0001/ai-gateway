package com.smartcache.gateway.controller;

import com.smartcache.gateway.service.ChatService;
import com.smartcache.gateway.service.DynamicIntentRouter;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1")
public class ChatController {

    private final ChatService chatService;
    private final DynamicIntentRouter intentRouter;

    // Inject both the ChatService and your new IntentRouter
    public ChatController(ChatService chatService, DynamicIntentRouter intentRouter) {
        this.chatService = chatService;
        this.intentRouter = intentRouter;
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
            // 1. ZERO-LATENCY FAST-PATH: Check RAM-cached intents first
            Optional<String> fastResponse = intentRouter.checkFastPath(prompt);
            
            if (fastResponse.isPresent()) {
                return ResponseEntity.ok(Map.of(
                    "chatId", chatId,
                    "response", fastResponse.get()
                ));
            }

            // 2. GENERATIVE PATH: Pass to AI Service if no intent matched
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
}