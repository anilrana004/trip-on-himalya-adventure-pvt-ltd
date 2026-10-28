package com.securetravels.crm.incident;

import com.securetravels.crm.common.security.CurrentUser;
import com.securetravels.crm.incident.dto.CreateIncidentRequest;
import com.securetravels.crm.incident.dto.FieldIncidentResponse;
import com.securetravels.crm.incident.dto.ResolveIncidentRequest;
import com.securetravels.crm.user.UserPrincipal;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/incidents")
public class FieldIncidentController {

    private final FieldIncidentService incidents;

    public FieldIncidentController(FieldIncidentService incidents) {
        this.incidents = incidents;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('OPS', 'MANAGER', 'ADMIN', 'CEO')")
    public List<FieldIncidentResponse> list(@RequestParam(required = false) FieldIncident.Status status,
                                            @CurrentUser UserPrincipal caller) {
        return incidents.list(status, caller);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('OPS', 'MANAGER', 'ADMIN', 'CEO')")
    public FieldIncidentResponse create(@Valid @RequestBody CreateIncidentRequest request,
                                        @CurrentUser UserPrincipal caller) {
        return incidents.create(request, caller);
    }

    @PostMapping(path = "/{id}/resolve", consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('OPS', 'MANAGER', 'ADMIN', 'CEO')")
    public FieldIncidentResponse resolve(@PathVariable UUID id,
                                         @Valid @RequestBody ResolveIncidentRequest request,
                                         @CurrentUser UserPrincipal caller) {
        return incidents.resolve(id, request, caller);
    }
}
