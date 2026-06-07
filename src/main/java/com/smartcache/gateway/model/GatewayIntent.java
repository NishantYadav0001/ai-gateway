package com.smartcache.gateway.model;

import jakarta.persistence.*;

@Entity
@Table(name = "gateway_intents")
public class GatewayIntent {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String intentName;
    private String pattern;
    private String response;
    private boolean isRegex;
    private boolean isActive;

    // Getters and Setters
    public String getPattern() { return pattern; }
    public String getResponse() { return response; }
    public boolean isRegex() { return isRegex; }
    public boolean isActive() { return isActive; }
}