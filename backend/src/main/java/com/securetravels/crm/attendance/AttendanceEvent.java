package com.securetravels.crm.attendance;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One punch. Rows are inserted and never updated. A correction is a later event.
 */
@Entity
@Table(name = "attendance_events")
public class AttendanceEvent {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "client_event_id", updatable = false)
    private UUID clientEventId;

    @Enumerated(EnumType.STRING)
    @Column(name = "event_type", nullable = false, updatable = false, length = 20)
    private AttendanceEventType eventType;

    @Column(name = "work_date", nullable = false, updatable = false)
    private LocalDate workDate;

    @Column(name = "server_time", nullable = false, updatable = false)
    private Instant serverTime;

    @Column(name = "device_time", updatable = false)
    private Instant deviceTime;

    @Column(name = "clock_skew_flagged", nullable = false, updatable = false)
    private boolean clockSkewFlagged;

    @Column(name = "recorded_by", updatable = false)
    private UUID recordedBy;

    @Column(updatable = false)
    private String notes;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected AttendanceEvent() {}

    public AttendanceEvent(UUID id, UUID userId, UUID clientEventId, AttendanceEventType eventType,
                           LocalDate workDate, Instant serverTime, Instant deviceTime,
                           boolean clockSkewFlagged, UUID recordedBy, String notes) {
        this.id = id;
        this.userId = userId;
        this.clientEventId = clientEventId;
        this.eventType = eventType;
        this.workDate = workDate;
        this.serverTime = serverTime;
        this.deviceTime = deviceTime;
        this.clockSkewFlagged = clockSkewFlagged;
        this.recordedBy = recordedBy;
        this.notes = notes;
        this.createdAt = serverTime;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public UUID getClientEventId() { return clientEventId; }
    public AttendanceEventType getEventType() { return eventType; }
    public LocalDate getWorkDate() { return workDate; }
    public Instant getServerTime() { return serverTime; }
    public Instant getDeviceTime() { return deviceTime; }
    public boolean isClockSkewFlagged() { return clockSkewFlagged; }
    public UUID getRecordedBy() { return recordedBy; }
    public String getNotes() { return notes; }
}
