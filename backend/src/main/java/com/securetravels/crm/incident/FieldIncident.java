package com.securetravels.crm.incident;

import com.securetravels.crm.common.audit.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "field_incidents")
public class FieldIncident extends Auditable {

    public enum Kind { MEDICAL, WEATHER, ALTITUDE, OTHER }

    public enum Status { OPEN, RESOLVED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "booking_id", nullable = false)
    private UUID bookingId;

    @Column(name = "batch_id")
    private UUID batchId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(nullable = false, columnDefinition = "text")
    private String summary;

    @Column(name = "occurred_on", nullable = false)
    private LocalDate occurredOn;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.OPEN;

    @Column(columnDefinition = "text")
    private String resolution;

    @Column(name = "reported_by")
    private UUID reportedBy;

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    protected FieldIncident() {}

    public FieldIncident(UUID bookingId, UUID batchId, Kind kind, String summary, LocalDate occurredOn, UUID reportedBy) {
        this.bookingId = bookingId;
        this.batchId = batchId;
        this.kind = kind;
        this.summary = summary;
        this.occurredOn = occurredOn;
        this.reportedBy = reportedBy;
    }

    public UUID getId() { return id; }
    public UUID getBookingId() { return bookingId; }
    public UUID getBatchId() { return batchId; }
    public Kind getKind() { return kind; }
    public String getSummary() { return summary; }
    public LocalDate getOccurredOn() { return occurredOn; }
    public Status getStatus() { return status; }
    public String getResolution() { return resolution; }
    public UUID getReportedBy() { return reportedBy; }
    public UUID getResolvedBy() { return resolvedBy; }
    public Instant getResolvedAt() { return resolvedAt; }

    public void resolve(String resolution, UUID resolvedBy, Instant resolvedAt) {
        this.status = Status.RESOLVED;
        this.resolution = resolution;
        this.resolvedBy = resolvedBy;
        this.resolvedAt = resolvedAt;
    }
}
