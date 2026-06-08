package com.smartcache.gateway.controller;

import com.smartcache.gateway.service.ChatService;
import com.smartcache.gateway.service.DynamicIntentRouter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.MediaType;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/chat") // Base path for all methods below
public class ChatController {

    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    
    private final ChatService chatService;
    private final DynamicIntentRouter intentRouter;

    public ChatController(ChatService chatService, DynamicIntentRouter intentRouter) {
        this.chatService = chatService;
        this.intentRouter = intentRouter;
    }

    // 1. BLOCKING REQUEST ENDPOINT
    // FIXED: Removed "/chat" to prevent /api/v1/chat/chat mapping
    @PostMapping({"", "/"}) 
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
            Optional<String> fastResponse = intentRouter.checkFastPath(prompt);
            
            if (fastResponse.isPresent()) {
                return ResponseEntity.ok(Map.of(
                    "chatId", chatId,
                    "response", fastResponse.get()
                ));
            }

            String aiResponse = chatService.processChatMessage(chatId, prompt, userId);

            return ResponseEntity.ok(Map.of(
                "chatId", chatId,
                "response", aiResponse
            ));

        } catch (Exception e) {
            logger.error("Error processing chat request", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to communicate with AI provider."));
        }
    }

    // 2. STREAMING REQUEST ENDPOINT (This is what your React app uses)
    // FIXED: Changed path to "/stream" so it maps exactly to /api/v1/chat/stream
    @PostMapping(value = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> handleChatStream(
            @RequestBody ChatRequest request,
            @AuthenticationPrincipal Jwt jwt) {

        String prompt = request.prompt();
        
        // FIXED: Strictly enforce JWT subject. No more "anonymous" ghost saves.
        String userId = jwt != null ? jwt.getSubject() : null; 
        
        String chatId = (request.chatId() != null && !request.chatId().trim().isEmpty())
                ? request.chatId()
                : UUID.randomUUID().toString();

        logger.info("Incoming Stream Request - ChatID: {}, UserID: {}", chatId, userId);

        if (userId == null || userId.isBlank()) {
            logger.error("Stream rejected: Missing or Invalid JWT Token.");
            return Flux.error(new SecurityException("Invalid or missing JWT subject"));
        }

        if (prompt == null || prompt.trim().isEmpty()) {
            return Flux.error(new IllegalArgumentException("Prompt cannot be empty"));
        }

        Optional<String> fastResponse = intentRouter.checkFastPath(prompt);
        if (fastResponse.isPresent()) {
            return Flux.just(fastResponse.get());
        }

        return chatService.processChatMessageStream(chatId, prompt, userId);
    }

    // 3. HISTORY ENDPOINTS
    @GetMapping("/history")
    public ResponseEntity<List<Map<String, Object>>> getHistory(@AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        List<Map<String, Object>> history = chatService.getUserChatSessions(userId);
        return ResponseEntity.ok(history);
    }

    @GetMapping("/history/{chatId}")
    public ResponseEntity<List<Map<String, Object>>> loadChatMessages(
            @PathVariable String chatId, 
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        return ResponseEntity.ok(chatService.getChatMessages(chatId, userId));
    }

    @DeleteMapping("/{chatId}")
    public ResponseEntity<Void> deleteChat(
            @PathVariable String chatId, 
            @AuthenticationPrincipal Jwt jwt) {
        String userId = jwt.getSubject();
        chatService.deleteChatSession(chatId, userId);
        return ResponseEntity.noContent().build();
    }
    
    // Request DTO
    public record ChatRequest(String chatId, String prompt) {}
}