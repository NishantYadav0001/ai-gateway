package com.smartcache.gateway.repository;

import com.smartcache.gateway.model.ApiUsage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ApiUsageRepository extends JpaRepository<ApiUsage, Long> {
}
