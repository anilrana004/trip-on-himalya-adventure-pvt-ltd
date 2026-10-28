package com.securetravels.crm.webhook;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface WebhookLogRepository extends JpaRepository<WebhookLog, UUID> {

    interface AttemptRow {
        UUID getId();
        String getStatus();
        String getErrorMessage();
        UUID getLeadId();
        Instant getCreatedAt();
    }

    @Query("""
            select w.id as id, w.status as status, w.errorMessage as errorMessage,
                   w.leadId as leadId, w.createdAt as createdAt
            from WebhookLog w
            order by w.createdAt desc
            """)
    List<AttemptRow> latestAttempts(Pageable pageable);
}