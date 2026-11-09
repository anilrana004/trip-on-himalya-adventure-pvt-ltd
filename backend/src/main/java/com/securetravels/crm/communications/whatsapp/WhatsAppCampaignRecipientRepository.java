package com.securetravels.crm.communications.whatsapp;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface WhatsAppCampaignRecipientRepository extends JpaRepository<WhatsAppCampaignRecipient, UUID> {

    List<WhatsAppCampaignRecipient> findByStatusOrderByCreatedAtAsc(
            WhatsAppCampaignRecipient.Status status, Pageable pageable);
}
