package com.securetravels.crm.trip.highlight;

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

/** A selling line or card chip written on one trek. Sales uses the same words with a lead. */
@Entity
@Table(name = "trip_highlights")
public class TripHighlight extends CreatedOnly {

    public enum Kind { SUMMARY, CHIP }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false, length = 160)
    private String label;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "on_card", nullable = false)
    private boolean onCard;

    @Column(nullable = false)
    private boolean published = true;

    @Column(name = "created_by")
    private UUID createdBy;

    protected TripHighlight() {}

    public TripHighlight(UUID tripId, String label, Kind kind, int sortOrder, boolean onCard, boolean published) {
        this.tripId = tripId;
        this.label = label;
        this.kind = kind;
        this.sortOrder = sortOrder;
        this.onCard = onCard;
        this.published = published;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getLabel() { return label; }
    public Kind getKind() { return kind; }
    public int getSortOrder() { return sortOrder; }
    public boolean isOnCard() { return onCard; }
    public boolean isPublished() { return published; }
    public UUID getCreatedBy() { return createdBy; }

    public void setLabel(String label) { this.label = label; }
    public void setKind(Kind kind) { this.kind = kind; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public void setOnCard(boolean onCard) { this.onCard = onCard; }
    public void setPublished(boolean published) { this.published = published; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}
