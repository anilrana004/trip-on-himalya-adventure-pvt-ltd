package com.securetravels.crm.attendance.dto;

import java.util.UUID;

/** Null reportsTo clears the line manager. */
public record ReportsToRequest(UUID reportsTo) {
}
