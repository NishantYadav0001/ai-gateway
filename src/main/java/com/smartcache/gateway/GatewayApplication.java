package com.smartcache.gateway;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

// @SpringBootApplication
// public class GatewayApplication {

// 	public static void main(String[] args) {
// 		SpringApplication.run(GatewayApplication.class, args);
// 	}

// }
@SpringBootApplication
public class GatewayApplication {
    public static void main(String[] args) {
        System.out.println("DEBUG - Current DB User: " + System.getenv("DB_USER"));
        // Do not print the full password for security, just show the length
        String pass = System.getenv("DB_PASS");
        System.out.println("DEBUG - Current DB Pass Length: " + (pass != null ? pass.length() : "NULL"));
        
        SpringApplication.run(GatewayApplication.class, args);
    }
}