package com.securetravels.crm.trip.faq;

import com.securetravels.crm.common.audit.CreatedOnly;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.util.UUID;

/** A question and answer published on one trek. Sales uses the same text when a lead asks. */
@Entity
@Table(name = "trip_faqs")
public class TripFaq extends CreatedOnly {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false, length = 300)
    private String question;

    @Column(nullable = false, columnDefinition = "text")
    private String answer;

    @Column(nullable = false)
    private boolean published = true;

    @Column(name = "created_by")
    private UUID createdBy;

    protected TripFaq() {}

    public TripFaq(UUID tripId, String question, String answer, boolean published) {
        this.tripId = tripId;
        this.question = question;
        this.answer = answer;
        this.published = published;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getQuestion() { return question; }
    public String getAnswer() { return answer; }
    public boolean isPublished() { return published; }
    public UUID getCreatedBy() { return createdBy; }

    public void setQuestion(String question) { this.question = question; }
    public void setAnswer(String answer) { this.answer = answer; }
    public void setPublished(boolean published) { this.published = published; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}
