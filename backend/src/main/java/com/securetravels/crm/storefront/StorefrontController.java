package com.securetravels.crm.storefront;

import com.securetravels.crm.storefront.dto.StorefrontTripCard;
import com.securetravels.crm.storefront.dto.StorefrontTripDetail;
import io.swagger.v3.oas.annotations.Operation;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public, unauthenticated catalogue for the Trip On Himalaya customer storefront.
 * Never exposes CRM-only fields (content brief, inactive drafts, money ledgers).
 */
@RestController
@RequestMapping("/api/storefront")
public class StorefrontController {

    private final StorefrontService storefront;

    public StorefrontController(StorefrontService storefront) {
        this.storefront = storefront;
    }

    @Operation(summary = "List live treks / packages for the public store")
    @GetMapping(path = "/trips", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<StorefrontTripCard> list(
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String q) {
        return storefront.listActive(category, q);
    }

    @Operation(summary = "Public trek detail by slug")
    @GetMapping(path = "/trips/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
    public StorefrontTripDetail get(@PathVariable String slug) {
        return storefront.getBySlug(slug);
    }
}
