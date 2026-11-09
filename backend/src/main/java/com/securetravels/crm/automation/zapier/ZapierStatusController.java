package com.securetravels.crm.automation.zapier;

import com.securetravels.crm.common.config.AppProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Operator view of which Zapier Catch Hooks are configured (no secret values).
 */
@RestController
@RequestMapping("/api/v1/automation/zapier")
@Tag(name = "Zapier automation")
@SecurityRequirement(name = "bearerAuth")
public class ZapierStatusController {

    private final AppProperties props;

    public ZapierStatusController(AppProperties props) {
        this.props = props;
    }

    @Operation(summary = "Zapier hook configuration status for the Automations desk")
    @GetMapping("/status")
    @PreAuthorize("hasAnyRole('SALES', 'MANAGER', 'ADMIN', 'CEO')")
    public Map<String, Object> status() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hooks", List.of(
                hook("events", "Lifecycle alerts (lead / SLA / quote / book)",
                        props.getZapier().getEventsHookUrl(),
                        "ZAPIER_EVENTS_HOOK_URL",
                        "Catch Hook → Slack / Gmail"),
                hook("emailCampaigns", "Bulk email campaigns",
                        props.getEmail().getZapierHookUrl(),
                        "ZAPIER_EMAIL_HOOK_URL",
                        "Catch Hook → Gmail / Mailchimp"),
                hook("whatsappCampaigns", "Bulk WhatsApp campaigns",
                        props.getWhatsApp().getZapierHookUrl(),
                        "ZAPIER_WHATSAPP_HOOK_URL",
                        "Catch Hook → WhatsApp / Interakt"),
                hook("facebookInbound", "Facebook Lead Ads → CRM (inbound)",
                        configuredSecret(props.getWebhook().getSecret()) ? "configured" : "",
                        "WEBHOOK_SECRET + Zap POST /api/webhook/lead",
                        "Facebook Lead Ads → Code → CRM webhook")
        ));
        out.put("docs", List.of(
                "docs/deployment/FACEBOOK_ZAPIER.md",
                "docs/deployment/EVENTS_ZAPIER.md",
                "docs/deployment/EMAIL_ZAPIER.md",
                "docs/deployment/WHATSAPP_ZAPIER.md"
        ));
        return out;
    }

    private static Map<String, Object> hook(String id, String label, String urlOrFlag,
                                            String envHint, String zapHint) {
        boolean configured = urlOrFlag != null && !urlOrFlag.isBlank();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("label", label);
        m.put("configured", configured);
        m.put("env", envHint);
        m.put("zap", zapHint);
        return m;
    }

    private static boolean configuredSecret(String secret) {
        return secret != null && !secret.isBlank()
                && !secret.contains("insecure-change-me");
    }
}
