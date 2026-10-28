package com.securetravels.crm.analytics.dto;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Operations Readiness.
 *
 * <p>Two of the four readiness signals exist and two do not, and the response
 * says which is which rather than shipping a uniform shape that implies equal
 * confidence across all of them.
 */
public record OperationsReadinessResponse(
        String scope,
        ReportFilter filter,
        IncidentSummary incidentSummary,
        List<BatchReadiness> batches,
        List<VendorScorecard> vendors,
        Totals totals) {

    /**
     * Counts rows in {@code field_incidents}. {@code available=true} and
     * {@code open=0} means the log exists and nobody has written an incident.
     * It does not claim the trail itself was trouble-free.
     */
    public record IncidentSummary(
            boolean available,
            String reason,
            String blockedBy,
            Long openIncidents,
            Long incidentsInPeriod) {
    }

    public record BatchReadiness(
            UUID batchId,
            UUID tripId,
            String tripName,
            String batchRef,
            Object departureDate,
            long pax,
            long seatsBooked,
            long maxCapacity,
            BigDecimal fillRatePct,
            String hotelStatus,
            String transportStatus,
            String paymentStatus,
            boolean tripSheetGenerated,
            List<String> gaps) {
    }

    /**
     * Vendor reliability derived from handoff assignment and confirmation only.
     *
     * <p>This is a <em>completion</em> score, not a reliability score, and it is
     * named accordingly. True reliability needs incident and re-work history,
     * which does not exist yet. With {@code scoreBasis} on every row the reader
     * is never left guessing which one they are looking at.
     */
    public record VendorScorecard(
            UUID vendorId,
            String vendorName,
            String category,
            String scoreBasis,
            long handoffsAssigned,
            long handoffsConfirmed,
            BigDecimal completionPct,
            boolean isReliabilityScore) {
    }

    public record Totals(
            long batches,
            long batchesWithGaps,
            long vendors,
            long handoffs) {
    }
}
