package com.securetravels.crm.trip.dto;

import java.util.List;

public record TripImportResponse(
        int created,
        List<String> names
) {
}
