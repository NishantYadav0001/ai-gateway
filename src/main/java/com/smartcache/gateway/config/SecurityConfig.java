package com.smartcache.gateway.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Value("${app.security.allowed-origins:http://localhost:5173}")
    private String allowedOrigins;

    @Value("${OAUTH2_ISSUER_URI:}")
    private String issuerUri;

    @Value("${OAUTH2_JWK_SET_URI:}")
    private String jwkSetUri;

    @Bean
    @ConditionalOnProperty(name = "OAUTH2_ISSUER_URI", matchIfMissing = false)
    public JwtDecoder jwtDecoder() {
        if (!jwkSetUri.isBlank()) {
            return NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
        }

        if (!issuerUri.isBlank()) {
            // Strip trailing slash to avoid URI parsing errors
            String cleanIssuerUri = issuerUri.endsWith("/") ? issuerUri.substring(0, issuerUri.length() - 1) : issuerUri;
            try {
                return JwtDecoders.fromIssuerLocation(cleanIssuerUri);
            } catch (Exception e) {
                // If issuer location is unreachable (e.g., placeholder URL), log warning and return a mock decoder
                System.err.println("Warning: Unable to connect to OAuth2 issuer: " + cleanIssuerUri + ". Message: " + e.getMessage());
                System.err.println("Proceeding with security chain without OAuth2 JWT validation. Set a valid OAUTH2_ISSUER_URI or OAUTH2_JWK_SET_URI for production.");
                // Return a no-op decoder that always succeeds for development/testing
                return token -> null;
            }
        }

        // Return a no-op decoder if no OAuth2 config is provided
        return token -> null;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(csrf -> csrf.disable())
            .authorizeHttpRequests(authorize -> authorize
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**").permitAll()
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers("/api/v1/chat", "/api/v1/chat/").authenticated()
                .anyRequest().permitAll()
            )
            .oauth2ResourceServer(oauth2 -> oauth2.jwt(Customizer.withDefaults()));

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .filter(origin -> !origin.isEmpty())
                .toList();

        config.setAllowedOriginPatterns(origins);
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
