package com.securetravels.crm.marketing;

import com.fasterxml.jackson.databind.JsonNode;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.ServiceUnavailableException;
import com.securetravels.crm.marketing.dto.MetaAdAccountResponse;
import com.securetravels.crm.marketing.dto.MetaApiCallLogResponse;
import com.securetravels.crm.marketing.dto.MetaCampaignResponse;
import com.securetravels.crm.marketing.dto.MetaDiagnosticsResponse;
import com.securetravels.crm.marketing.dto.MetaInsightsResponse;
import com.securetravels.crm.marketing.dto.MetaPageResponse;
import com.securetravels.crm.marketing.dto.MetaUsageSummaryResponse;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class MetaMarketingService {

    private static final int MAX_PAGES = 20;
    private static final int MAX_CURSOR_LEN = 512;
    private static final java.util.regex.Pattern ACCOUNT_ID =
            java.util.regex.Pattern.compile("^act_[0-9]+$");
    private static final java.util.regex.Pattern ISO_DATE =
            java.util.regex.Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Set<String> INSIGHT_LEVELS = Set.of("campaign", "adset", "ad", "account");
    private static final String CAMPAIGN_FIELDS = "id,name,status,effective_status,objective,updated_time";
    private static final String INSIGHT_FIELDS =
            "campaign_id,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,date_start,date_stop";

    private final MetaGraphClient graph;
    private final MetaAdAccountRepository accounts;
    private final MetaApiCallLogRepository callLogs;
    private final AppProperties props;
    private final MetaAccessGuard access;

    public MetaMarketingService(MetaGraphClient graph, MetaAdAccountRepository accounts,
                                MetaApiCallLogRepository callLogs, AppProperties props,
                                MetaAccessGuard access) {
        this.graph = graph;
        this.accounts = accounts;
        this.callLogs = callLogs;
        this.props = props;
        this.access = access;
    }

    /**
     * Cheap, non-mutating connectivity check for operators. At most two Graph
     * GETs ({@code me}, {@code me/adaccounts?limit=1} or one allowlisted account).
     */
    public MetaDiagnosticsResponse diagnostics() {
        AppProperties.Meta meta = props.getMeta();
        var flags = new MetaDiagnosticsResponse.ConfigFlags(
                present(meta.getAccessToken()),
                present(meta.getAppSecret()),
                present(meta.getWebhookVerifyToken()),
                present(meta.getAppId()),
                present(meta.getAdAccountIds()));
        boolean webhookReady = flags.appSecretSet() && flags.webhookVerifyTokenSet();
        String version = present(meta.getGraphVersion()) ? meta.getGraphVersion().trim() : "v22.0";

        if (!flags.accessTokenSet()) {
            return report(
                    flags,
                    MetaDiagnosticsResponse.ConnectivityStatus.CONFIG_MISSING,
                    "META_ACCESS_TOKEN is not set on the server. Configure it in Railway Variables.",
                    version,
                    null,
                    null,
                    webhookReady,
                    MetaAccessGuard.Snapshot.unconfigured());
        }

        MetaAccessGuard.Snapshot snap = access.inspect();
        if (snap.graphError() != null) {
            return report(
                    flags,
                    classify(snap.graphError()),
                    actionable(snap.graphError()),
                    version,
                    null,
                    null,
                    webhookReady,
                    snap);
        }

        if (!snap.adsEnabled()) {
            String message = "Token authenticated, but campaigns and insights stay off until ads_read or ads_management is granted.";
            if (snap.leadsEnabled()) {
                message += " Lead retrieval is separately enabled.";
            } else {
                message += " Lead retrieval also stays off until leads_retrieval is granted.";
            }
            return report(
                    flags,
                    MetaDiagnosticsResponse.ConnectivityStatus.PERMISSION_FAILURE,
                    message,
                    version,
                    snap.graphUserId(),
                    null,
                    webhookReady,
                    snap);
        }

        try {
            int visible;
            Set<String> allow = configuredAllowlist();
            if (!allow.isEmpty()) {
                String sample = allow.iterator().next();
                graph.get("diagnostics.adaccount", sample, sample, Map.of("fields", "id,name"));
                visible = allow.size();
            } else {
                JsonNode accountsPage = graph.get(
                        "diagnostics.adaccounts",
                        null,
                        "me/adaccounts",
                        Map.of("fields", "id", "limit", "5"));
                visible = 0;
                if (accountsPage.path("data").isArray()) {
                    visible = accountsPage.path("data").size();
                }
            }

            String message = visible == 0
                    ? "Token authenticated, but no ad accounts were visible. Check Business asset assignment / META_AD_ACCOUNT_IDS."
                    : "Meta Graph connectivity OK. Token can see ad account data.";
            if (!snap.leadsEnabled()) {
                message += " Lead retrieval stays off until leads_retrieval is granted.";
            }
            var status = visible == 0
                    ? MetaDiagnosticsResponse.ConnectivityStatus.ACCOUNT_INACCESSIBLE
                    : MetaDiagnosticsResponse.ConnectivityStatus.OK;

            return report(flags, status, message, version, snap.graphUserId(), visible, webhookReady, snap);
        } catch (MetaGraphException ex) {
            return report(flags, classify(ex), actionable(ex), version, snap.graphUserId(), null, webhookReady, snap);
        } catch (ServiceUnavailableException ex) {
            return report(
                    flags,
                    MetaDiagnosticsResponse.ConnectivityStatus.CONFIG_MISSING,
                    ex.getMessage(),
                    version,
                    null,
                    null,
                    webhookReady,
                    snap);
        }
    }

    private static MetaDiagnosticsResponse report(
            MetaDiagnosticsResponse.ConfigFlags flags,
            MetaDiagnosticsResponse.ConnectivityStatus status,
            String message,
            String version,
            String graphUserId,
            Integer visible,
            boolean webhookReady,
            MetaAccessGuard.Snapshot snap) {
        return new MetaDiagnosticsResponse(
                flags,
                status,
                message,
                version,
                graphUserId,
                visible,
                webhookReady,
                new MetaDiagnosticsResponse.Capabilities(
                        snap.adsEnabled(),
                        snap.leadsEnabled(),
                        snap.granted(),
                        snap.missingForAds(),
                        snap.missingForLeads(),
                        snap.missingPageAccess()));
    }

    private static MetaDiagnosticsResponse.ConnectivityStatus classify(MetaGraphException ex) {
        int http = ex.httpStatus();
        String code = ex.errorCode() == null ? "" : ex.errorCode();
        if (http == 429 || code.contains(":4") || code.contains(":17") || code.contains(":32")) {
            return MetaDiagnosticsResponse.ConnectivityStatus.RATE_LIMITED;
        }
        if (http == 401 || code.contains("190") || code.contains("OAuthException")) {
            return MetaDiagnosticsResponse.ConnectivityStatus.AUTH_FAILURE;
        }
        if (http == 403 || code.contains("10") || code.contains("200") || code.contains("294")) {
            return MetaDiagnosticsResponse.ConnectivityStatus.PERMISSION_FAILURE;
        }
        if (http == 400 && (code.contains("100") || code.contains("803"))) {
            return MetaDiagnosticsResponse.ConnectivityStatus.ACCOUNT_INACCESSIBLE;
        }
        if (ex.retryable() || http >= 500 || "TRANSPORT".equals(code) || code.startsWith("TRANSPORT")) {
            return MetaDiagnosticsResponse.ConnectivityStatus.UNAVAILABLE;
        }
        if (http == 400 || http == 404) {
            return MetaDiagnosticsResponse.ConnectivityStatus.ACCOUNT_INACCESSIBLE;
        }
        return MetaDiagnosticsResponse.ConnectivityStatus.UNAVAILABLE;
    }

    private static String actionable(MetaGraphException ex) {
        return switch (classify(ex)) {
            case AUTH_FAILURE ->
                    "Meta rejected the access token (expired, revoked, or invalid). Rotate META_ACCESS_TOKEN on Railway.";
            case PERMISSION_FAILURE ->
                    "Meta token lacks required permissions or Business asset access. Grant ads_read / ads_management as needed and assign ad accounts.";
            case ACCOUNT_INACCESSIBLE ->
                    "Ad account not reachable with this token. Check META_AD_ACCOUNT_IDS and Business Manager assignments.";
            case RATE_LIMITED ->
                    "Meta rate-limited the diagnostic call. Wait and retry; do not loop.";
            case UNAVAILABLE ->
                    "Meta Graph was unreachable or returned a transient error. Retry later.";
            case CONFIG_MISSING ->
                    "META_ACCESS_TOKEN is not configured.";
            case OK ->
                    "OK";
        };
    }

    @Transactional(readOnly = true)
    public MetaUsageSummaryResponse usageSummary(int days, int limit) {
        int windowDays = Math.min(Math.max(days, 1), 90);
        int rowLimit = Math.min(Math.max(limit, 1), 100);
        Instant from = Instant.now().minus(windowDays, ChronoUnit.DAYS);
        Instant to = Instant.now();
        long ok = callLogs.countSince(from, true);
        long fail = callLogs.countSince(from, false);
        List<MetaApiCallLogResponse> recent = callLogs
                .findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(from, PageRequest.of(0, rowLimit))
                .stream()
                .map(l -> new MetaApiCallLogResponse(
                        l.getId(),
                        l.getCorrelationId(),
                        l.getOperation(),
                        l.getAccountId(),
                        l.getGraphVersion(),
                        l.getHttpStatus(),
                        l.isSuccess(),
                        l.getErrorCode(),
                        l.getCreatedAt()))
                .toList();
        return new MetaUsageSummaryResponse(
                ok, fail, new MetaUsageSummaryResponse.InstantWindow(from, to), recent);
    }

    @Transactional
    public List<MetaAdAccountResponse> listAdAccounts() {
        requireConfigured();
        access.requireAds();
        Map<String, String> query = Map.of(
                "fields", "id,account_id,name,currency,account_status",
                "limit", "50");
        List<JsonNode> nodes = graph.getAllPages(
                "adaccounts.list",
                null,
                "me/adaccounts",
                query,
                MAX_PAGES,
                body -> body.path("data").elements());

        Set<String> allow = configuredAllowlist();
        List<MetaAdAccountResponse> out = new ArrayList<>();
        for (JsonNode n : nodes) {
            String id = normalizeAccountId(firstNonBlank(n.path("id").asText(null), n.path("account_id").asText(null)));
            if (id == null) {
                continue;
            }
            if (!allow.isEmpty() && !allow.contains(id) && !allow.contains(stripAct(id))) {
                continue;
            }
            String name = n.path("name").asText(id);
            String currency = textOrNull(n, "currency");
            Integer status = n.hasNonNull("account_status") ? n.get("account_status").asInt() : null;
            upsertLocal(id, name, currency, status);
            out.add(new MetaAdAccountResponse(id, name, currency, status));
        }
        return out;
    }

    public MetaPageResponse<MetaCampaignResponse> listCampaigns(String accountId, String after, int limit) {
        requireConfigured();
        access.requireAds();
        String act = assertAuthorizedAccount(accountId);
        int pageSize = Math.min(Math.max(limit, 1), 100);
        Map<String, String> query = new LinkedHashMap<>();
        query.put("fields", CAMPAIGN_FIELDS);
        query.put("limit", String.valueOf(pageSize));
        if (after != null && !after.isBlank()) {
            String cursor = after.trim();
            if (cursor.length() > MAX_CURSOR_LEN || cursor.chars().anyMatch(Character::isWhitespace)) {
                throw new BadRequestException("Invalid pagination cursor");
            }
            query.put("after", cursor);
        }

        JsonNode body = graph.get("campaigns.list", act, act + "/campaigns", query);
        List<MetaCampaignResponse> rows = new ArrayList<>();
        body.path("data").forEach(n -> rows.add(new MetaCampaignResponse(
                textOrNull(n, "id"),
                textOrNull(n, "name"),
                textOrNull(n, "status"),
                textOrNull(n, "effective_status"),
                textOrNull(n, "objective"),
                textOrNull(n, "updated_time"))));
        String next = body.path("paging").path("cursors").path("after").asText(null);
        boolean hasMore = body.path("paging").hasNonNull("next");
        return new MetaPageResponse<>(rows, hasMore ? next : null, hasMore);
    }

    public MetaInsightsResponse insights(String accountId, String datePreset, String since, String until,
                                         String level) {
        requireConfigured();
        access.requireAds();
        String act = assertAuthorizedAccount(accountId);

        boolean hasRange = notBlank(since) || notBlank(until);
        if (hasRange && (isBlank(since) || isBlank(until))) {
            throw new BadRequestException("Both since and until are required for a custom date range (YYYY-MM-DD)");
        }
        if (hasRange && (notBlank(datePreset))) {
            throw new BadRequestException("Provide either datePreset or since/until, not both");
        }
        if (hasRange && (!ISO_DATE.matcher(since.trim()).matches() || !ISO_DATE.matcher(until.trim()).matches())) {
            throw new BadRequestException("since/until must be YYYY-MM-DD");
        }

        String resolvedLevel = level == null || level.isBlank() ? "campaign" : level.trim().toLowerCase(Locale.ROOT);
        if (!INSIGHT_LEVELS.contains(resolvedLevel)) {
            throw new BadRequestException("insights level must be one of: campaign, adset, ad, account");
        }

        Map<String, String> query = new LinkedHashMap<>();
        query.put("fields", INSIGHT_FIELDS);
        query.put("level", resolvedLevel);
        query.put("limit", "100");
        if (hasRange) {
            query.put("time_range", "{\"since\":\"" + since.trim() + "\",\"until\":\"" + until.trim() + "\"}");
        } else {
            query.put("date_preset", notBlank(datePreset) ? datePreset.trim() : "last_7d");
        }

        List<JsonNode> nodes = graph.getAllPages(
                "insights.list",
                act,
                act + "/insights",
                query,
                MAX_PAGES,
                body -> body.path("data").elements());

        List<MetaInsightsResponse.MetaInsightRow> rows = new ArrayList<>();
        for (JsonNode n : nodes) {
            rows.add(new MetaInsightsResponse.MetaInsightRow(
                    textOrNull(n, "campaign_id"),
                    textOrNull(n, "campaign_name"),
                    textOrNull(n, "impressions"),
                    textOrNull(n, "clicks"),
                    textOrNull(n, "spend"),
                    textOrNull(n, "cpc"),
                    textOrNull(n, "cpm"),
                    textOrNull(n, "ctr"),
                    textOrNull(n, "date_start"),
                    textOrNull(n, "date_stop")));
        }
        return new MetaInsightsResponse(
                act,
                hasRange ? null : query.get("date_preset"),
                hasRange ? since : null,
                hasRange ? until : null,
                rows);
    }

    private void upsertLocal(String id, String name, String currency, Integer status) {
        MetaAdAccount entity = accounts.findByMetaAccountId(id)
                .orElseGet(() -> new MetaAdAccount(id, name));
        entity.applySync(name, currency, status);
        accounts.save(entity);
    }

    String assertAuthorizedAccount(String raw) {
        String act = normalizeAccountId(raw);
        if (act == null) {
            throw new BadRequestException("ad account id is required");
        }
        Set<String> allow = configuredAllowlist();
        if (!allow.isEmpty()) {
            if (!allow.contains(act) && !allow.contains(stripAct(act))) {
                throw new ForbiddenException("Ad account is not authorized for this CRM integration");
            }
            return act;
        }
        // No static allowlist: require the account to have been discovered/synced,
        // or accept act_ form and verify via a cheap Graph read on first use.
        if (accounts.findByMetaAccountId(act).isPresent()) {
            return act;
        }
        JsonNode node = graph.get("adaccount.get", act, act, Map.of("fields", "id,name"));
        String id = normalizeAccountId(node.path("id").asText(act));
        upsertLocal(id, node.path("name").asText(id), null, null);
        return id;
    }

    private Set<String> configuredAllowlist() {
        String raw = props.getMeta().getAdAccountIds();
        if (raw == null || raw.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(raw.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(this::normalizeAccountId)
                .filter(s -> s != null)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private void requireConfigured() {
        if (!props.getMeta().configured()) {
            throw new ServiceUnavailableException(
                    "Meta Marketing API is not configured. Set META_ACCESS_TOKEN on the server.");
        }
    }

    private String normalizeAccountId(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String trimmed = raw.trim();
        String candidate;
        if (trimmed.regionMatches(true, 0, "act_", 0, 4)) {
            candidate = "act_" + trimmed.substring(4);
        } else if (trimmed.chars().allMatch(Character::isDigit)) {
            candidate = "act_" + trimmed;
        } else {
            return null;
        }
        // Reject path/query injection (e.g. act_1/../me) before any Graph path concat.
        return ACCOUNT_ID.matcher(candidate).matches() ? candidate : null;
    }

    private static String stripAct(String id) {
        return id != null && id.startsWith("act_") ? id.substring(4) : id;
    }

    private static String textOrNull(JsonNode n, String field) {
        JsonNode v = n.get(field);
        if (v == null || v.isNull()) {
            return null;
        }
        String text = v.asText();
        return text == null || text.isBlank() ? null : text;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) {
            return a;
        }
        if (b != null && !b.isBlank()) {
            return b;
        }
        return null;
    }

    private static boolean notBlank(String v) {
        return v != null && !v.isBlank();
    }

    private static boolean isBlank(String v) {
        return v == null || v.isBlank();
    }

    private static boolean present(String v) {
        return v != null && !v.isBlank();
    }
}
