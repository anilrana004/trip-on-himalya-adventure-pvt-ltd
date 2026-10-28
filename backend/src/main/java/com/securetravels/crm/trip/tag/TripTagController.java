package com.securetravels.crm.trip.tag;

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
@RequestMapping("/api/tags")
public class TripTagController {

    private final TripTagService tags;

    public TripTagController(TripTagService tags) {
        this.tags = tags;
    }

    @Operation(summary = "Terrain and season tags on treks", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    public List<TripTagResponse> list() {
        return tags.list();
    }

    @Operation(summary = "Add a terrain or season tag on a trek", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
    public TripTagResponse create(@Valid @RequestBody TripTagWriteRequest request, @CurrentUser UserPrincipal caller) {
        return tags.create(request, caller);
    }

    @Operation(summary = "Copy tags from one trek onto another", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(value = "/copy", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
    public TripTagCopyResponse copy(@Valid @RequestBody TripTagCopyRequest request, @CurrentUser UserPrincipal caller) {
        return tags.copy(request, caller);
    }

    @Operation(summary = "Edit a trek tag", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
    public TripTagResponse update(@PathVariable UUID id, @Valid @RequestBody TripTagWriteRequest request,
                                  @CurrentUser UserPrincipal caller) {
        return tags.update(id, request, caller);
    }

    @Operation(summary = "Remove a trek tag", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN', 'CEO')")
    public void delete(@PathVariable UUID id, @CurrentUser UserPrincipal caller) {
        tags.delete(id, caller);
    }
}
