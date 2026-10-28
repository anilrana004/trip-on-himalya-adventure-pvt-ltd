package com.securetravels.crm.trip.waypoint;

import com.securetravels.crm.common.security.CurrentUser;
import com.securetravels.crm.user.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/waypoints")
public class TripWaypointController {

    private final TripWaypointService waypoints;

    public TripWaypointController(TripWaypointService waypoints) {
        this.waypoints = waypoints;
    }

    @Operation(summary = "Route points plotted on treks", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    public List<TripWaypointResponse> list() {
        return waypoints.list();
    }

    @Operation(summary = "Plot a point on a trek route", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripWaypointResponse create(@Valid @RequestBody TripWaypointWriteRequest request,
                                       @CurrentUser UserPrincipal caller) {
        return waypoints.create(request, caller);
    }

    @Operation(summary = "Edit a route point", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripWaypointResponse update(@PathVariable UUID id, @Valid @RequestBody TripWaypointWriteRequest request,
                                       @CurrentUser UserPrincipal caller) {
        return waypoints.update(id, request, caller);
    }

    @Operation(summary = "Remove a route point", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public void delete(@PathVariable UUID id, @CurrentUser UserPrincipal caller) {
        waypoints.delete(id, caller);
    }
}
