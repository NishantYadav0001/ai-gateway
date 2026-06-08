package com.smartcache.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;

@SpringBootTest(properties = {
    "OAUTH2_JWK_SET_URI=https://example.com/.well-known/jwks.json",
    "OAUTH2_ISSUER_URI=https://example.com/",
    "GROQ_API_KEY=dummy",
    "GEMINI_API_KEY=dummy",
    "PINECONE_API_KEY=dummy",
    "DB_USER=dummy",
    "DB_PASS=dummy",
    "spring.datasource.url=jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE",
    "spring.datasource.driverClassName=org.h2.Driver"
})
class GatewayApplicationTests {

	@Test
	void contextLoads() {
	}

}