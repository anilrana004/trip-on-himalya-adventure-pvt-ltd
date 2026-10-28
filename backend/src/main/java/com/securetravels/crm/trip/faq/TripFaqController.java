package com.securetravels.crm.trip.faq;

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
@RequestMapping("/api/faqs")
public class TripFaqController {

    private final TripFaqService faqs;

    public TripFaqController(TripFaqService faqs) {
        this.faqs = faqs;
    }

    @Operation(summary = "Trek FAQs. Managers see unpublished questions; others see published only.",
            security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    public List<TripFaqResponse> list(@CurrentUser UserPrincipal caller) {
        return faqs.list(caller);
    }

    @Operation(summary = "Add a question on a trek", security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripFaqResponse create(@Valid @RequestBody TripFaqWriteRequest request, @CurrentUser UserPrincipal caller) {
        return faqs.create(request, caller);
    }

    @Operation(summary = "Copy published questions from one trek onto another",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping(value = "/copy", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripFaqCopyResponse copy(@Valid @RequestBody TripFaqCopyRequest request, @CurrentUser UserPrincipal caller) {
        return faqs.copy(request, caller);
    }

    @Operation(summary = "Edit a trek FAQ", security = @SecurityRequirement(name = "bearerAuth"))
    @PatchMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public TripFaqResponse update(@PathVariable UUID id, @Valid @RequestBody TripFaqWriteRequest request,
                                  @CurrentUser UserPrincipal caller) {
        return faqs.update(id, request, caller);
    }

    @Operation(summary = "Remove a trek FAQ", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public void delete(@PathVariable UUID id, @CurrentUser UserPrincipal caller) {
        faqs.delete(id, caller);
    }
}
