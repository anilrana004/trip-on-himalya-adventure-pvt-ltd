package com.securetravels.crm.marketing;

import com.fasterxml.jackson.databind.JsonNode;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.ServiceUnavailableException;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Checks the server token with Graph before Ads calls and before lead
 * retrieval. Ads and leads use different permissions and are not treated as
 * one switch. The token value is never logged or returned.
 */
@Component
public class MetaAccessGuard {

    static final List<String> ADS_ANY = List.of("ads_read", "ads_management");
    static final String LEADS = "leads_retrieval";
    static final List<String> PAGE_ACCESS = List.of(
            "pages_show_list",
            "pages_read_engagement",
            "pages_manage_ads",
            "pages_manage_metadata");

    private static final long CACHE_MS = 60_000L;

    private final MetaGraphClient graph;
    private final AppProperties props;

    private volatile Snapshot cached;
    private volatile long cachedAt;
    private volatile int cachedTokenKey;

    public MetaAccessGuard(MetaGraphClient graph, AppProperties props) {
        this.graph = graph;
        this.props = props;
    }

    public Snapshot inspect() {
        if (!props.getMeta().configured()) {
            return Snapshot.unconfigured();
        }
        int key = tokenKey();
        Snapshot hit = cached;
        if (hit != null && hit.authenticated() && cachedTokenKey == key
                && System.currentTimeMillis() - cachedAt < CACHE_MS) {
            return hit;
        }
        Snapshot fresh = load();
        if (fresh.authenticated()) {
            cached = fresh;
            cachedAt = System.currentTimeMillis();
            cachedTokenKey = key;
        }
        return fresh;
    }

    public void requireAds() {
        Snapshot snap = inspect();
        if (!snap.tokenConfigured()) {
            throw new ServiceUnavailableException(
                    "Meta Marketing API is not configured. Set META_ACCESS_TOKEN on the server.");
        }
        if (snap.graphError() != null) {
            throw snap.graphError();
        }
        if (!snap.adsEnabled()) {
            throw new ForbiddenException(
                    "Campaigns and insights are disabled. Grant ads_read or ads_management on the system user. "
                            + "leads_retrieval does not enable Ads API calls.");
        }
    }

    public void requireLeads() {
        Snapshot snap = inspect();
        if (!snap.tokenConfigured()) {
            throw new ServiceUnavailableException(
                    "Meta Marketing API is not configured. Set META_ACCESS_TOKEN on the server.");
        }
        if (snap.graphError() != null) {
            throw snap.graphError();
        }
        if (!snap.leadsEnabled()) {
            throw new ForbiddenException(
                    "Lead retrieval is disabled. Grant leads_retrieval on the system user. "
                            + "ads_read does not enable lead fetch.");
        }
    }

    private Snapshot load() {
        try {
            JsonNode me = graph.get("diagnostics.me", null, "me", Map.of("fields", "id"));
            JsonNode perms = graph.get("diagnostics.permissions", null, "me/permissions", Map.of());
            String userId = me.path("id").asText(null);
            if (userId != null && userId.isBlank()) {
                userId = null;
            }
            return Snapshot.ready(userId, grantedNames(perms));
        } catch (MetaGraphException ex) {
            return Snapshot.failed(ex);
        }
    }

    static Set<String> grantedNames(JsonNode body) {
        Set<String> granted = new TreeSet<>();
        if (body == null) {
            return granted;
        }
        for (JsonNode row : body.path("data")) {
            String name = row.path("permission").asText("");
            if (!"granted".equals(row.path("status").asText()) || !name.matches("[a-z0-9_]{1,64}")) {
                continue;
            }
            granted.add(name);
        }
        return granted;
    }

    private int tokenKey() {
        String token = props.getMeta().getAccessToken();
        return token == null ? 0 : token.hashCode();
    }

    public record Snapshot(
            boolean tokenConfigured,
            boolean authenticated,
            String graphUserId,
            List<String> granted,
            boolean adsEnabled,
            boolean leadsEnabled,
            List<String> missingForAds,
            List<String> missingForLeads,
            List<String> missingPageAccess,
            MetaGraphException graphError
    ) {
        static Snapshot unconfigured() {
            return new Snapshot(
                    false, false, null, List.of(), false, false,
                    ADS_ANY, List.of(LEADS), PAGE_ACCESS, null);
        }

        static Snapshot failed(MetaGraphException error) {
            return new Snapshot(
                    true, false, null, List.of(), false, false,
                    List.of(), List.of(), List.of(), error);
        }

        static Snapshot ready(String graphUserId, Set<String> granted) {
            boolean ads = granted.contains("ads_read") || granted.contains("ads_management");
            boolean leads = granted.contains(LEADS);
            List<String> missingAds = ads ? List.of() : ADS_ANY;
            List<String> missingLeads = leads ? List.of() : List.of(LEADS);
            List<String> missingPages = new ArrayList<>();
            for (String name : PAGE_ACCESS) {
                if (!granted.contains(name)) {
                    missingPages.add(name);
                }
            }
            return new Snapshot(
                    true,
                    true,
                    graphUserId,
                    List.copyOf(granted),
                    ads,
                    leads,
                    missingAds,
                    missingLeads,
                    List.copyOf(missingPages),
                    null);
        }
    }
}
