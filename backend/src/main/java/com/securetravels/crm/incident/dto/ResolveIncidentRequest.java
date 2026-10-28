package com.securetravels.crm.incident.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ResolveIncidentRequest(
        @NotBlank @Size(max = 2000) String resolution
) {}
