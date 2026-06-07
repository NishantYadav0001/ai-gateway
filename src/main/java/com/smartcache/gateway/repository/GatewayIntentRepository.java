package com.smartcache.gateway.repository;

import com.smartcache.gateway.model.GatewayIntent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GatewayIntentRepository extends JpaRepository<GatewayIntent, Long> {
    // We only want rules that are currently toggled "ON" in the database
    List<GatewayIntent> findByIsActiveTrue();
}