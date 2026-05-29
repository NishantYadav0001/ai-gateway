package com.smartcache.gateway.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.servlet.view.RedirectView;

@Controller // Note: Changed from @RestController to @Controller to allow redirects
public class HealthController {

    // 1. When you visit the main URL, instantly redirect to Swagger
    @GetMapping("/")
    public RedirectView redirectToSwagger() {
        return new RedirectView("/swagger-ui/index.html");
    }

    // 2. Give Render a dedicated, silent endpoint just for health checks
    @GetMapping("/health")
    @ResponseBody
    public String healthCheck() {
        return "Gateway is Live and Healthy!";
    }
}