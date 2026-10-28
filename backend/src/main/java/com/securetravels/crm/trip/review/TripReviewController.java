package com.securetravels.crm.trip.review;

import com.securetravels.crm.common.security.CurrentUser;
import com.securetravels.crm.user.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/reviews")
public class TripReviewController {

    private final TripReviewService reviews;

    public TripReviewController(TripReviewService reviews) {
        this.reviews = reviews;
    }

    @Operation(summary = "Latest trek reviews. Managers see pending and hidden; others see published only.",
            security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    public List<TripReviewResponse> list(@CurrentUser UserPrincipal caller) {
        return reviews.list(caller);
    }

    @Operation(summary = "Record a guest review. It stays pending until published.",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripReviewResponse create(@Valid @RequestBody TripReviewCreateRequest request,
                                     @CurrentUser UserPrincipal caller) {
        return reviews.create(request, caller);
    }

    @Operation(summary = "Publish, hide, or return a review to pending",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripReviewResponse updateStatus(@PathVariable UUID id,
                                           @Valid @RequestBody TripReviewStatusRequest request,
                                           @CurrentUser UserPrincipal caller) {
        return reviews.updateStatus(id, request.status(), caller);
    }
}
