package com.securetravels.crm.communications.whatsapp;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "whatsapp_campaign_recipients")
public class WhatsAppCampaignRecipient {

    public enum Status { QUEUED, SENT, FAILED, SKIPPED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "campaign_id", nullable = false)
    private UUID campaignId;

    @Column(name = "lead_id", nullable = false)
    private UUID leadId;

    @Column(nullable = false, length = 30)
    private String mobile;

    @Column(name = "customer_name", nullable = false, length = 200)
    private String customerName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.QUEUED;

    @Column(name = "skip_reason", length = 200)
    private String skipReason;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "provider_ref", length = 120)
    private String providerRef;

    @Column(nullable = false)
    private int attempts;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "processed_at")
    private Instant processedAt;

    protected WhatsAppCampaignRecipient() {}

    public WhatsAppCampaignRecipient(UUID campaignId, UUID leadId, String mobile, String customerName) {
        this.campaignId = campaignId;
        this.leadId = leadId;
        this.mobile = mobile;
        this.customerName = customerName;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getCampaignId() { return campaignId; }
    public UUID getLeadId() { return leadId; }
    public String getMobile() { return mobile; }
    public String getCustomerName() { return customerName; }
    public Status getStatus() { return status; }

    public void markSent(String providerRef) {
        this.status = Status.SENT;
        this.providerRef = providerRef;
        this.attempts++;
        this.processedAt = Instant.now();
    }

    public void markFailed(String error) {
        this.status = Status.FAILED;
        this.errorMessage = error == null ? null : error.substring(0, Math.min(1000, error.length()));
        this.attempts++;
        this.processedAt = Instant.now();
    }

    public void markSkipped(String reason) {
        this.status = Status.SKIPPED;
        this.skipReason = reason == null ? null : reason.substring(0, Math.min(200, reason.length()));
        this.processedAt = Instant.now();
    }
}
