package com.securetravels.crm.common.security;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Expands exact Vercel production origins into allowlist patterns that also
 * cover git preview deployments ({@code *-git-*.vercel.app}) without requiring
 * operators to paste every preview URL into Railway.
 */
public final class CorsOriginPatterns {

    private CorsOriginPatterns() {
    }

    public static List<String> expand(List<String> configured) {
        if (configured == null || configured.isEmpty()) {
            return List.of();
        }
        Set<String> out = new LinkedHashSet<>();
        for (String raw : configured) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String origin = stripTrailingSlash(raw.trim());
            out.add(origin);
            String preview = vercelPreviewPattern(origin);
            if (preview != null) {
                out.add(preview);
            }
        }
        return new ArrayList<>(out);
    }

    /**
     * {@code https://my-app.vercel.app} → {@code https://my-app*.vercel.app}
     * so branch previews like {@code my-app-git-abc-team.vercel.app} match.
     */
    static String vercelPreviewPattern(String origin) {
        String lower = origin.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("https://") || !lower.endsWith(".vercel.app") || lower.contains("*")) {
            return null;
        }
        String host = origin.substring("https://".length());
        int dot = host.indexOf('.');
        if (dot <= 0) {
            return null;
        }
        String project = host.substring(0, dot);
        return "https://" + project + "*.vercel.app";
    }

    private static String stripTrailingSlash(String value) {
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
