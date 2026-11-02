package com.securetravels.crm.lead;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LeadCallAttemptRepository extends JpaRepository<LeadCallAttempt, UUID> {

    List<LeadCallAttempt> findTop50ByLeadIdOrderByCreatedAtDesc(UUID leadId);

    long countByLeadId(UUID leadId);
}
