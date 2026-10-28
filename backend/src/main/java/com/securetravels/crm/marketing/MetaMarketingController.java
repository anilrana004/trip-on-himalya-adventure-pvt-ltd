package com.securetravels.crm.marketing;

import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.ServiceUnavailableException;
import com.securetravels.crm.marketing.dto.MetaAdAccountResponse;
import com.securetravels.crm.marketing.dto.MetaCampaignResponse;
import com.securetravels.crm.marketing.dto.MetaDiagnosticsResponse;
import com.securetravels.crm.marketing.dto.MetaInsightsResponse;
import com.securetravels.crm.marketing.dto.MetaPageResponse;
import com.securetravels.crm.marketing.dto.MetaUsageSummaryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/marketing/meta")
@SecurityRequirement(name = "bearerAuth")
public class MetaMarketingController {

    private final MetaMarketingService marketing;

    public MetaMarketingController(MetaMarketingService marketing) {
        this.marketing = marketing;
    }

    @Operation(summary = "List Meta ad accounts authorized for this integration")
    @GetMapping(value = "/ad-accounts", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public List<MetaAdAccountResponse> adAccounts() {
        return invoke(() -> marketing.listAdAccounts());
    }

    @Operation(summary = "List campaigns for an authorized ad account")
    @GetMapping(value = "/ad-accounts/{accountId}/campaigns", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public MetaPageResponse<MetaCampaignResponse> campaigns(
            @PathVariable String accountId,
            @RequestParam(required = false) String after,
            @RequestParam(defaultValue = "25") int limit) {
        return invoke(() -> marketing.listCampaigns(accountId, after, limit));
    }

    @Operation(summary = "Campaign-level insights for an authorized ad account")
    @GetMapping(value = "/ad-accounts/{accountId}/insights", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public MetaInsightsResponse insights(
            @PathVariable String accountId,
            @RequestParam(required = false) String datePreset,
            @RequestParam(required = false) String since,
            @RequestParam(required = false) String until,
            @RequestParam(required = false, defaultValue = "campaign") String level) {
        return invoke(() -> marketing.insights(accountId, datePreset, since, until, level));
    }

    @Operation(summary = "Sanitized Meta Ads API usage log (Standard Access evidence)")
    @GetMapping(value = "/usage", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public MetaUsageSummaryResponse usage(
            @RequestParam(defaultValue = "15") int days,
            @RequestParam(defaultValue = "50") int limit) {
        return marketing.usageSummary(days, limit);
    }

    @Operation(summary = "Safe Meta connectivity diagnostic (config flags + cheap Graph check)")
    @GetMapping(value = "/diagnostics", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('MANAGER', 'ADMIN', 'CEO')")
    public MetaDiagnosticsResponse diagnostics() {
        return marketing.diagnostics();
    }

    private <T> T invoke(SupplierEx<T> action) {
        try {
            return action.get();
        } catch (BadRequestException | ForbiddenException | ServiceUnavailableException ex) {
            throw ex;
        } catch (MetaGraphException ex) {
            if (ex.httpStatus() == 401 || ex.httpStatus() == 403
                    || (ex.errorCode() != null && ex.errorCode().contains("190"))) {
                throw new ForbiddenException("Meta rejected the request (permissions or token). " + safeMsg(ex));
            }
            if (ex.retryable()) {
                throw new ServiceUnavailableException("Meta API temporarily unavailable: " + safeMsg(ex));
            }
            throw new BadRequestException("Meta API error: " + safeMsg(ex));
        }
    }

    private static String safeMsg(MetaGraphException ex) {
        String msg = ex.getMessage() == null ? "request failed" : ex.getMessage();
        // Never echo token-shaped fragments if Meta ever includes them.
        String cleaned = msg.replaceAll("(?i)access_token=[^&\\s]+", "access_token=***");
        cleaned = cleaned.replaceAll("(?i)EAA[A-Za-z0-9]+", "***");
        return cleaned;
    }

    @FunctionalInterface
    private interface SupplierEx<T> {
        T get();
    }
}
