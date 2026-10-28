package com.securetravels.crm.marketing.dto;

/**
 * Non-sensitive Meta connectivity report. Never includes tokens, secrets,
 * or full Graph payloads.
 */
public record MetaDiagnosticsResponse(
        ConfigFlags config,
        ConnectivityStatus status,
        String message,
        String graphVersion,
        String graphUserId,
        Integer visibleAdAccountCount,
        boolean webhookConfigReady,
        Capabilities capabilities
) {
    /**
     * Permission split from {@code me/permissions}. Names only — never a token.
     * Ads calls require {@code ads_read} or {@code ads_management}. Lead fetch
     * requires {@code leads_retrieval}. Page permissions are reported and do
     * not by themselves enable either path.
     */
    public record Capabilities(
            boolean adsEnabled,
            boolean leadsEnabled,
            java.util.List<String> granted,
            java.util.List<String> missingForAds,
            java.util.List<String> missingForLeads,
            java.util.List<String> missingPageAccess
    ) {}

    public record ConfigFlags(
            boolean accessTokenSet,
            boolean appSecretSet,
            boolean webhookVerifyTokenSet,
            boolean appIdSet,
            boolean adAccountAllowlistSet
    ) {}

    public enum ConnectivityStatus {
        CONFIG_MISSING,
        AUTH_FAILURE,
        PERMISSION_FAILURE,
        ACCOUNT_INACCESSIBLE,
        RATE_LIMITED,
        UNAVAILABLE,
        OK
    }
}
