package com.securetravels.crm.trip.review;

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

/** A guest rating of one trek. Published rows are the only ones that count in the catalogue average. */
@Entity
@Table(name = "trip_reviews")
public class TripReview extends CreatedOnly {

    public enum Status { PENDING, PUBLISHED, HIDDEN }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(name = "booking_id")
    private UUID bookingId;

    @Column(name = "guest_name", nullable = false, length = 200)
    private String guestName;

    @Column(nullable = false)
    private int rating;

    @Column(columnDefinition = "text")
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.PENDING;

    @Column(name = "created_by")
    private UUID createdBy;

    protected TripReview() {}

    public TripReview(UUID tripId, String guestName, int rating, Status status) {
        this.tripId = tripId;
        this.guestName = guestName;
        this.rating = rating;
        this.status = status;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public UUID getBookingId() { return bookingId; }
    public String getGuestName() { return guestName; }
    public int getRating() { return rating; }
    public String getBody() { return body; }
    public Status getStatus() { return status; }
    public UUID getCreatedBy() { return createdBy; }

    public void setBookingId(UUID bookingId) { this.bookingId = bookingId; }
    public void setBody(String body) { this.body = body; }
    public void setStatus(Status status) { this.status = status; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}
