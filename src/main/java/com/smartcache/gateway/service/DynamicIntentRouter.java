package com.smartcache.gateway.service;

import com.smartcache.gateway.model.GatewayIntent;
import com.smartcache.gateway.repository.GatewayIntentRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class DynamicIntentRouter {

    private final GatewayIntentRepository repository;
    private List<GatewayIntent> activeIntents;

    public DynamicIntentRouter(GatewayIntentRepository repository) {
        this.repository = repository;
    }

    // Loads the rules into memory when the app starts
    @PostConstruct
    public void loadIntentsFromDatabase() {
        this.activeIntents = repository.findByIsActiveTrue();
        System.out.println("Loaded " + activeIntents.size() + " Fast-Path intents into memory.");
    }

    // Call this via an Admin API if you add a new row to the DB and want to refresh without restarting
    public void refreshIntents() {
        loadIntentsFromDatabase();
    }

    /**
     * Checks the user input against all RAM-cached database rules.
     * @return Optional containing the static response, or empty if no match.
     */
    public Optional<String> checkFastPath(String input) {
        String normalizedInput = input.trim().toLowerCase();
        // Standardize spacing
        normalizedInput = normalizedInput.replaceAll("\\s+", " ");

        for (GatewayIntent intent : activeIntents) {
            if (intent.isRegex()) {
                if (normalizedInput.matches(intent.getPattern())) {
                    return Optional.of(intent.getResponse());
                }
            } else {
                // Exact string match
                if (normalizedInput.equals(intent.getPattern().toLowerCase())) {
                    return Optional.of(intent.getResponse());
                }
            }
        }
        
        // No match found, it's time to call the AI
        return Optional.empty();
    }
}