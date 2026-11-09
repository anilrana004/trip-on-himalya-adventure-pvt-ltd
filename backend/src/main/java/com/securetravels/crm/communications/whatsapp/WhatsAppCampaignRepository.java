package com.securetravels.crm.communications.whatsapp;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WhatsAppCampaignRepository extends JpaRepository<WhatsAppCampaign, UUID> {

    List<WhatsAppCampaign> findTop20ByOrderByCreatedAtDesc();
}
