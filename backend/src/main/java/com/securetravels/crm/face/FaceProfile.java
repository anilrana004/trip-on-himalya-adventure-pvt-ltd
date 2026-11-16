package com.securetravels.crm.face;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "face_profiles")
public class FaceProfile {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false, unique = true)
    private UUID userId;

    @Column(nullable = false, length = 40)
    private String model = "face-api-128";

    @Column(name = "descriptor_json", nullable = false, columnDefinition = "TEXT")
    private String descriptorJson;

    @Column(name = "sample_count", nullable = false)
    private int sampleCount = 1;

    @Column(name = "snapshot_jpeg")
    private byte[] snapshotJpeg;

    @Column(name = "enrolled_by", nullable = false)
    private UUID enrolledBy;

    @Column(name = "enrolled_at", nullable = false)
    private Instant enrolledAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(nullable = false)
    private boolean active = true;

    protected FaceProfile() {
    }

    public FaceProfile(UUID id, UUID userId, String descriptorJson, int sampleCount,
                       byte[] snapshotJpeg, UUID enrolledBy, Instant when) {
        this.id = id;
        this.userId = userId;
        this.descriptorJson = descriptorJson;
        this.sampleCount = sampleCount;
        this.snapshotJpeg = snapshotJpeg;
        this.enrolledBy = enrolledBy;
        this.enrolledAt = when;
        this.updatedAt = when;
        this.active = true;
    }

    public void replace(String descriptorJson, int sampleCount, byte[] snapshotJpeg, UUID enrolledBy, Instant when) {
        this.descriptorJson = descriptorJson;
        this.sampleCount = sampleCount;
        if (snapshotJpeg != null) {
            this.snapshotJpeg = snapshotJpeg;
        }
        this.enrolledBy = enrolledBy;
        this.updatedAt = when;
        this.active = true;
    }

    public void deactivate(Instant when) {
        this.active = false;
        this.updatedAt = when;
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getModel() { return model; }
    public String getDescriptorJson() { return descriptorJson; }
    public int getSampleCount() { return sampleCount; }
    public byte[] getSnapshotJpeg() { return snapshotJpeg; }
    public UUID getEnrolledBy() { return enrolledBy; }
    public Instant getEnrolledAt() { return enrolledAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public boolean isActive() { return active; }
}
