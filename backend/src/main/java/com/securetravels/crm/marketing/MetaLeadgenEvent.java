package com.securetravels.crm.marketing;

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
@Table(name = "meta_leadgen_events")
public class MetaLeadgenEvent {

    public enum Status { RECEIVED, PROCESSED, DUPLICATE, FAILED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "meta_lead_id", nullable = false, unique = true, length = 64)
    private String metaLeadId;

    @Column(name = "page_id", length = 64)
    private String pageId;

    @Column(name = "form_id", length = 64)
    private String formId;

    @Column(name = "ad_id", length = 64)
    private String adId;

    @Column(name = "adgroup_id", length = 64)
    private String adgroupId;

    @Column(name = "campaign_id", length = 64)
    private String campaignId;

    @Column(name = "lead_id")
    private UUID leadId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.RECEIVED;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "processed_at")
    private Instant processedAt;

    protected MetaLeadgenEvent() {}

    public MetaLeadgenEvent(String metaLeadId, String pageId, String formId,
                            String adId, String adgroupId, String campaignId) {
        this.metaLeadId = metaLeadId;
        this.pageId = pageId;
        this.formId = formId;
        this.adId = adId;
        this.adgroupId = adgroupId;
        this.campaignId = campaignId;
    }

    public UUID getId() { return id; }
    public String getMetaLeadId() { return metaLeadId; }
    public String getPageId() { return pageId; }
    public String getFormId() { return formId; }
    public String getAdId() { return adId; }
    public String getAdgroupId() { return adgroupId; }
    public String getCampaignId() { return campaignId; }
    public Status getStatus() { return status; }
    public String getErrorMessage() { return errorMessage; }
    public UUID getLeadId() { return leadId; }

    public void markProcessed(UUID leadId) {
        this.leadId = leadId;
        this.status = Status.PROCESSED;
        this.processedAt = Instant.now();
        this.errorMessage = null;
    }

    public void markDuplicate(UUID leadId) {
        this.leadId = leadId;
        this.status = Status.DUPLICATE;
        this.processedAt = Instant.now();
    }

    public void markFailed(String message) {
        this.status = Status.FAILED;
        this.processedAt = Instant.now();
        this.errorMessage = message == null ? null
                : message.substring(0, Math.min(1000, message.length()));
    }
}
