package com.securetravels.crm.trip.tag;

import com.securetravels.crm.common.audit.CreatedOnly;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/** A terrain or season label written on one trek. The same words filter the catalogue and the card. */
@Entity
@Table(name = "trip_tags")
public class TripTag extends CreatedOnly {

    public enum Kind { TERRAIN, SEASON }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false, length = 40)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(name = "on_card", nullable = false)
    private boolean onCard;

    @Column(name = "created_by")
    private UUID createdBy;

    protected TripTag() {}

    public TripTag(UUID tripId, String label, Kind kind, boolean onCard) {
        this.tripId = tripId;
        this.label = label;
        this.kind = kind;
        this.onCard = onCard;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getLabel() { return label; }
    public Kind getKind() { return kind; }
    public boolean isOnCard() { return onCard; }
    public UUID getCreatedBy() { return createdBy; }

    public void setLabel(String label) { this.label = label; }
    public void setKind(Kind kind) { this.kind = kind; }
    public void setOnCard(boolean onCard) { this.onCard = onCard; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}
