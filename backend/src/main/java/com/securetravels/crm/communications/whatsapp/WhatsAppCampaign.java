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
@Table(name = "whatsapp_campaigns")
public class WhatsAppCampaign {

    public enum DeliveryMode { INLINE, ZAPIER }
    public enum Status { QUEUED, RUNNING, COMPLETED, CANCELLED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "template_code", length = 80)
    private String templateCode;

    @Column(name = "body_text", columnDefinition = "text")
    private String bodyText;

    @Enumerated(EnumType.STRING)
    @Column(name = "delivery_mode", nullable = false, length = 20)
    private DeliveryMode deliveryMode = DeliveryMode.ZAPIER;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.QUEUED;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "total_recipients", nullable = false)
    private int totalRecipients;

    @Column(name = "sent_count", nullable = false)
    private int sentCount;

    @Column(name = "failed_count", nullable = false)
    private int failedCount;

    @Column(name = "skipped_count", nullable = false)
    private int skippedCount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected WhatsAppCampaign() {}

    public WhatsAppCampaign(String name, String templateCode, String bodyText,
                            DeliveryMode deliveryMode, UUID createdBy) {
        this.name = name;
        this.templateCode = templateCode;
        this.bodyText = bodyText;
        this.deliveryMode = deliveryMode == null ? DeliveryMode.ZAPIER : deliveryMode;
        this.createdBy = createdBy;
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public String getName() { return name; }
    public String getTemplateCode() { return templateCode; }
    public String getBodyText() { return bodyText; }
    public DeliveryMode getDeliveryMode() { return deliveryMode; }
    public Status getStatus() { return status; }
    public UUID getCreatedBy() { return createdBy; }
    public int getTotalRecipients() { return totalRecipients; }
    public int getSentCount() { return sentCount; }
    public int getFailedCount() { return failedCount; }
    public int getSkippedCount() { return skippedCount; }
    public Instant getCreatedAt() { return createdAt; }

    public void setTotalRecipients(int totalRecipients) { this.totalRecipients = totalRecipients; }
    public void markRunning() {
        this.status = Status.RUNNING;
        if (this.startedAt == null) this.startedAt = Instant.now();
    }
    public void incrementSent() { this.sentCount++; }
    public void incrementFailed() { this.failedCount++; }
    public void incrementSkipped() { this.skippedCount++; }
    public void markCompletedIfDone() {
        if (sentCount + failedCount + skippedCount >= totalRecipients) {
            this.status = Status.COMPLETED;
            this.completedAt = Instant.now();
        }
    }
}
