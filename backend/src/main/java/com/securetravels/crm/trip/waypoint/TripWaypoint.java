package com.securetravels.crm.trip.waypoint;

import com.securetravels.crm.common.audit.CreatedOnly;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.util.UUID;

/** One plotted point on a trek. The order of these points is the route operations walks. */
@Entity
@Table(name = "trip_waypoints")
public class TripWaypoint extends CreatedOnly {

    public enum Kind { START, CAMP, SUMMIT, PASS, END }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "trip_id", nullable = false)
    private UUID tripId;

    @Column(nullable = false, length = 80)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Kind kind;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal latitude;

    @Column(nullable = false, precision = 9, scale = 6)
    private BigDecimal longitude;

    @Column(name = "altitude_m")
    private Integer altitudeM;

    @Column(name = "day_number")
    private Integer dayNumber;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(name = "created_by")
    private UUID createdBy;

    protected TripWaypoint() {}

    public TripWaypoint(UUID tripId, String name, Kind kind, BigDecimal latitude, BigDecimal longitude,
                        Integer altitudeM, Integer dayNumber, int sortOrder) {
        this.tripId = tripId;
        this.name = name;
        this.kind = kind;
        this.latitude = latitude;
        this.longitude = longitude;
        this.altitudeM = altitudeM;
        this.dayNumber = dayNumber;
        this.sortOrder = sortOrder;
    }

    public UUID getId() { return id; }
    public UUID getTripId() { return tripId; }
    public String getName() { return name; }
    public Kind getKind() { return kind; }
    public BigDecimal getLatitude() { return latitude; }
    public BigDecimal getLongitude() { return longitude; }
    public Integer getAltitudeM() { return altitudeM; }
    public Integer getDayNumber() { return dayNumber; }
    public int getSortOrder() { return sortOrder; }
    public UUID getCreatedBy() { return createdBy; }

    public void setName(String name) { this.name = name; }
    public void setKind(Kind kind) { this.kind = kind; }
    public void setLatitude(BigDecimal latitude) { this.latitude = latitude; }
    public void setLongitude(BigDecimal longitude) { this.longitude = longitude; }
    public void setAltitudeM(Integer altitudeM) { this.altitudeM = altitudeM; }
    public void setDayNumber(Integer dayNumber) { this.dayNumber = dayNumber; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}
