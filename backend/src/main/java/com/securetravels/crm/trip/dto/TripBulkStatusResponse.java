package com.securetravels.crm.trip.dto;

import java.util.List;
import java.util.UUID;

public record TripBulkStatusResponse(
        int updated,
        int unchanged,
        List<UUID> missing
) {
}
