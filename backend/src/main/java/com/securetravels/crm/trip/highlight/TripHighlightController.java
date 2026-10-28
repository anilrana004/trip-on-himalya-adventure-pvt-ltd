package com.securetravels.crm.trip.highlight;

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
@RequestMapping("/api/highlights")
public class TripHighlightController {

    private final TripHighlightService highlights;

    public TripHighlightController(TripHighlightService highlights) {
        this.highlights = highlights;
    }

    @Operation(summary = "Trek highlights. Managers see unpublished lines; others see published only.",
            security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    public List<TripHighlightResponse> list(@CurrentUser UserPrincipal caller) {
        return highlights.list(caller);
    }

    @Operation(summary = "Add a selling line or card chip on a trek",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripHighlightResponse create(@Valid @RequestBody TripHighlightWriteRequest request,
                                        @CurrentUser UserPrincipal caller) {
        return highlights.create(request, caller);
    }

    @Operation(summary = "Copy published highlights from one trek onto another",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(value = "/copy", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripHighlightCopyResponse copy(@Valid @RequestBody TripHighlightCopyRequest request,
                                          @CurrentUser UserPrincipal caller) {
        return highlights.copy(request, caller);
    }

    @Operation(summary = "Edit a trek highlight", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripHighlightResponse update(@PathVariable UUID id, @Valid @RequestBody TripHighlightWriteRequest request,
                                        @CurrentUser UserPrincipal caller) {
        return highlights.update(id, request, caller);
    }

    @Operation(summary = "Remove a trek highlight", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public void delete(@PathVariable UUID id, @CurrentUser UserPrincipal caller) {
        highlights.delete(id, caller);
    }
}
