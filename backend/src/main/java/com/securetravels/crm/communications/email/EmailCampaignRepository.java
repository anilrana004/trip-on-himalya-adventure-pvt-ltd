package com.securetravels.crm.communications.email;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface EmailCampaignRepository extends JpaRepository<EmailCampaign, UUID> {

    List<EmailCampaign> findTop20ByOrderByCreatedAtDesc();
}
