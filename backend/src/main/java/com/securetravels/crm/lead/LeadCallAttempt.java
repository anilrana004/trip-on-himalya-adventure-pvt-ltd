package com.securetravels.crm.lead;

import com.securetravels.crm.common.util.XssSanitizer;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** One dial attempt logged by sales — visible to managers on the lead timeline. */
@Entity
@Table(name = "lead_call_attempts", indexes = {
        @Index(name = "idx_lead_call_attempts_lead", columnList = "lead_id, created_at")
})
public class LeadCallAttempt {

    public enum Outcome { CONNECTED, NO_ANSWER, BUSY, WRONG_NUMBER, CALLBACK, OTHER }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "lead_id", nullable = false)
    private UUID leadId;

    @Column(name = "actor_id")
    private UUID actorId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private Outcome outcome;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    protected LeadCallAttempt() {}

    public LeadCallAttempt(UUID leadId, UUID actorId, Outcome outcome, String notes) {
        this.leadId = leadId;
        this.actorId = actorId;
        this.outcome = outcome;
        this.notes = XssSanitizer.text(notes);
        this.createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public UUID getLeadId() { return leadId; }
    public UUID getActorId() { return actorId; }
    public Outcome getOutcome() { return outcome; }
    public String getNotes() { return notes; }
    public Instant getCreatedAt() { return createdAt; }
}
