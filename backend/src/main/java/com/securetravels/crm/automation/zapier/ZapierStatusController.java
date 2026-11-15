package com.securetravels.crm.automation.zapier;

import com.securetravels.crm.automation.WorkflowService;
import com.securetravels.crm.automation.domain.Workflow;
import com.securetravels.crm.automation.domain.WorkflowVersion;
import com.securetravels.crm.automation.migrate.MigrateWorkflowTemplates;
import com.securetravels.crm.automation.runtime.AutomationGuards;
import com.securetravels.crm.common.config.AppProperties;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Operator view of Zapier pipes vs native delivery (no secret values).
 */
@RestController
@RequestMapping("/api/v1/automation/zapier")
@Tag(name = "Zapier automation")
@SecurityRequirement(name = "bearerAuth")
public class ZapierStatusController {

    private final AppProperties props;
    private final ZapierEventsClient eventsClient;
    private final WorkflowService workflows;
    private final AutomationGuards guards;

    public ZapierStatusController(AppProperties props, ZapierEventsClient eventsClient,
                                  WorkflowService workflows, AutomationGuards guards) {
        this.props = props;
        this.eventsClient = eventsClient;
        this.workflows = workflows;
        this.guards = guards;
    }

    @Operation(summary = "Zapier + native automation status for the Automations desk")
    @GetMapping("/status")
    @PreAuthorize("hasAnyRole('SALES', 'MANAGER', 'ADMIN', 'CEO')")
    public Map<String, Object> status() {
        boolean eventsHook = httpsConfigured(props.getZapier().getEventsHookUrl());
        boolean eventsEnabled = props.getZapier().isEventsEnabled();
        boolean emailHook = httpsConfigured(props.getEmail().getZapierHookUrl());
        boolean waHook = httpsConfigured(props.getWhatsApp().getZapierHookUrl());
        boolean leadSecret = configuredSecret(props.getWebhook().getSecret());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("hooks", List.of(
                hook("events", "Lifecycle alerts (lead / SLA / quote / book)",
                        eventsHook, eventsHook && eventsEnabled,
                        "ZAPIER_EVENTS_HOOK_URL",
                        "Catch Hook → Slack / Gmail",
                        eventsEnabled ? null : "Paused by ZAPIER_EVENTS_ENABLED=false (URL kept for rollback)"),
                hook("emailCampaigns", "Bulk email campaigns",
                        emailHook, false,
                        "ZAPIER_EMAIL_HOOK_URL",
                        "Retired — CRM SendGate only",
                        "Campaigns force INLINE; hook URL kept unused"),
                hook("whatsappCampaigns", "Bulk WhatsApp campaigns",
                        waHook, false,
                        "ZAPIER_WHATSAPP_HOOK_URL",
                        "Retired — CRM SendGate only",
                        "Campaigns force INLINE; hook URL kept unused"),
                hook("facebookInbound", "Lead intake (HMAC webhook)",
                        leadSecret, leadSecret,
                        "WEBHOOK_SECRET + POST /api/webhook/lead",
                        "Storefront / signed partners → CRM webhook",
                        "Meta Lead Ads use /api/webhook/meta when META_* + ingest enabled")
        ));

        Map<String, Object> nativePath = new LinkedHashMap<>();
        nativePath.put("emailMode", props.getEmail().getMode().name());
        nativePath.put("whatsappMode", props.getWhatsApp().getMode().name());
        nativePath.put("leadWebhookSecretConfigured", leadSecret);
        nativePath.put("defaultCampaignDelivery", "INLINE");
        nativePath.put("lifecycleAlerts", "In-app notifications + EmailGateway (sandbox/SES); Zapier optional");
        nativePath.put("bookingWhatsApp", "SendGate → WhatsAppGateway (sandbox/Interakt)");
        nativePath.put("metaConfigured", props.getMeta().configured());
        nativePath.put("metaLeadgenIngestEnabled", props.getMeta().isLeadgenIngestEnabled());
        nativePath.put("metaIntake", props.getMeta().isLeadgenIngestEnabled()
                ? "Native /api/webhook/meta creates leads (ensure FB Zap is paused or dual-path tested)"
                : "Native Meta webhook acks only; Facebook Lead Ads Zap owns intake");
        nativePath.put("migrateShadowEnabled", props.getAutomation().isMigrateShadowEnabled());
        nativePath.put("automationDryRun", guards.dryRun());
        nativePath.put("legacyEffectsEnabled", props.getAutomation().isLegacyEffectsEnabled());
        nativePath.put("migrateShadow", cutoverSummary());
        out.put("native", nativePath);

        List<Map<String, Object>> migrateTemplates = new ArrayList<>();
        for (MigrateWorkflowTemplates.Template template : MigrateWorkflowTemplates.all()) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("slug", template.slug());
            row.put("name", template.name());
            Workflow wf = workflows.findBySlug(template.slug()).orElse(null);
            WorkflowVersion active = wf == null ? null : workflows.activeVersion(wf.getId()).orElse(null);
            row.put("active", active != null);
            row.put("version", active == null ? null : active.getVersionNumber());
            migrateTemplates.add(row);
        }
        Map<String, Object> migrate = new LinkedHashMap<>();
        migrate.put("shadowEnabled", props.getAutomation().isMigrateShadowEnabled());
        migrate.put("dryRun", guards.dryRun());
        migrate.put("legacyEffectsEnabled", props.getAutomation().isLegacyEffectsEnabled());
        migrate.put("engineLive", props.getAutomation().isMigrateShadowEnabled()
                && !guards.dryRun()
                && !props.getAutomation().isLegacyEffectsEnabled());
        migrate.put("templates", migrateTemplates);
        out.put("migrate", migrate);

        Map<String, Object> zapier = new LinkedHashMap<>();
        zapier.put("eventsEnabled", eventsEnabled);
        zapier.put("eventsHookConfigured", eventsHook);
        zapier.put("eventsActive", eventsHook && eventsEnabled);
        zapier.put("eventStats", eventsClient.stats());
        out.put("zapier", zapier);

        out.put("docs", List.of(
                "docs/automation/MIGRATION_STATUS.md",
                "docs/deployment/FACEBOOK_ZAPIER.md",
                "docs/deployment/EVENTS_ZAPIER.md",
                "docs/deployment/EMAIL_ZAPIER.md",
                "docs/deployment/WHATSAPP_ZAPIER.md"
        ));
        return out;
    }

    private static Map<String, Object> hook(String id, String label, boolean configured, boolean active,
                                            String envHint, String zapHint, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("label", label);
        m.put("configured", configured);
        m.put("active", active);
        m.put("env", envHint);
        m.put("zap", zapHint);
        if (note != null) {
            m.put("note", note);
        }
        return m;
    }

    private String cutoverSummary() {
        boolean templates = props.getAutomation().isMigrateShadowEnabled();
        boolean dry = guards.dryRun();
        boolean legacy = props.getAutomation().isLegacyEffectsEnabled();
        if (templates && !dry && !legacy) {
            return "Native live — M1–M11 engine owns effects; hard-coded MIGRATE paths off";
        }
        if (templates && dry) {
            return "Shadow dry-run — templates ACTIVE; effects skipped";
        }
        if (legacy) {
            return "Legacy hard-coded effects ON — set AUTOMATION_LEGACY_EFFECTS_ENABLED=false for engine cutover";
        }
        return "MIGRATE templates off — set AUTOMATION_MIGRATE_SHADOW_ENABLED=true to seed";
    }

    private static boolean httpsConfigured(String url) {
        return url != null && !url.isBlank() && url.startsWith("https://");
    }

    private static boolean configuredSecret(String secret) {
        return secret != null && !secret.isBlank()
                && !secret.contains("insecure-change-me");
    }
}
