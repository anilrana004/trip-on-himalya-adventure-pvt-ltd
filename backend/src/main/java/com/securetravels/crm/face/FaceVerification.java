package com.securetravels.crm.face;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "face_verifications")
public class FaceVerification {

    @Id
    private UUID id;

    @Column(name = "subject_user_id")
    private UUID subjectUserId;

    @Column(name = "matched_user_id")
    private UUID matchedUserId;

    @Column(name = "verified_by", nullable = false)
    private UUID verifiedBy;

    @Column(nullable = false, length = 30)
    private String purpose;

    @Column(nullable = false, length = 20)
    private String result;

    @Column(precision = 10, scale = 6)
    private BigDecimal score;

    @Column(name = "threshold_used", nullable = false, precision = 10, scale = 6)
    private BigDecimal thresholdUsed;

    @Column(name = "snapshot_jpeg")
    private byte[] snapshotJpeg;

    @Column(name = "login_session_id")
    private UUID loginSessionId;

    @Column(length = 200)
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FaceVerification() {
    }

    public FaceVerification(UUID id, UUID subjectUserId, UUID matchedUserId, UUID verifiedBy,
                            String purpose, String result, BigDecimal score, BigDecimal thresholdUsed,
                            byte[] snapshotJpeg, UUID loginSessionId, String note, Instant createdAt) {
        this.id = id;
        this.subjectUserId = subjectUserId;
        this.matchedUserId = matchedUserId;
        this.verifiedBy = verifiedBy;
        this.purpose = purpose;
        this.result = result;
        this.score = score;
        this.thresholdUsed = thresholdUsed;
        this.snapshotJpeg = snapshotJpeg;
        this.loginSessionId = loginSessionId;
        this.note = note;
        this.createdAt = createdAt;
    }

    public UUID getId() { return id; }
    public UUID getSubjectUserId() { return subjectUserId; }
    public UUID getMatchedUserId() { return matchedUserId; }
    public UUID getVerifiedBy() { return verifiedBy; }
    public String getPurpose() { return purpose; }
    public String getResult() { return result; }
    public BigDecimal getScore() { return score; }
    public BigDecimal getThresholdUsed() { return thresholdUsed; }
    public byte[] getSnapshotJpeg() { return snapshotJpeg; }
    public UUID getLoginSessionId() { return loginSessionId; }
    public String getNote() { return note; }
    public Instant getCreatedAt() { return createdAt; }
}
