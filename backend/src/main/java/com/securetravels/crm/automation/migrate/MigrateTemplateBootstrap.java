package com.securetravels.crm.automation.migrate;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.automation.WorkflowService;
import com.securetravels.crm.automation.domain.Workflow;
import com.securetravels.crm.automation.domain.WorkflowVersion;
import com.securetravels.crm.common.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * When {@code app.automation.migrate-shadow-enabled=true}, ensure M1–M11
 * workflow templates exist and stay ACTIVE on the latest library definition.
 */
@Component
@Order(40)
public class MigrateTemplateBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MigrateTemplateBootstrap.class);

    private final AppProperties props;
    private final WorkflowService workflows;
    private final ObjectMapper mapper;

    public MigrateTemplateBootstrap(AppProperties props, WorkflowService workflows, ObjectMapper mapper) {
        this.props = props;
        this.workflows = workflows;
        this.mapper = mapper;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.getAutomation().isMigrateShadowEnabled()) {
            log.info("[automation] native templates disabled; skipping bootstrap");
            return;
        }
        int activated = 0;
        int refreshed = 0;
        for (MigrateWorkflowTemplates.Template template : MigrateWorkflowTemplates.all()) {
            try {
                EnsureResult result = ensureActive(template);
                if (result.activated()) {
                    activated++;
                }
                if (result.refreshed()) {
                    refreshed++;
                }
            } catch (Exception ex) {
                log.warn("[automation] template {} bootstrap failed: {}",
                        template.slug(), ex.getMessage());
            }
        }
        log.info("[automation] native templates ready — {} seeded, {} refreshed (legacyEffects={} dryRun={})",
                activated,
                refreshed,
                props.getAutomation().isLegacyEffectsEnabled(),
                props.getAutomation().isDryRunEnabled());
    }

    private EnsureResult ensureActive(MigrateWorkflowTemplates.Template template) {
        Workflow workflow = workflows.findBySlug(template.slug()).orElseGet(() ->
                workflows.createWorkflow(template.slug(), template.name(), template.description(), null));

        WorkflowVersion active = workflows.activeVersion(workflow.getId()).orElse(null);
        if (active != null && sameDefinition(active.getDefinition(), template.definition())) {
            log.debug("[automation] template {} already ACTIVE v{} (current)",
                    template.slug(), active.getVersionNumber());
            return new EnsureResult(true, false);
        }

        workflows.saveDraft(workflow.getId(), template.definition(), null);
        WorkflowVersion published = workflows.activate(workflow.getId(), null);
        boolean refreshed = active != null;
        log.info("[automation] template {} {} as ACTIVE v{}",
                template.slug(),
                refreshed ? "refreshed" : "activated",
                published.getVersionNumber());
        return new EnsureResult(true, refreshed);
    }

    private boolean sameDefinition(String storedJson, Object libraryDefinition) {
        try {
            return mapper.readTree(storedJson).equals(mapper.valueToTree(libraryDefinition));
        } catch (Exception ex) {
            return false;
        }
    }

    private record EnsureResult(boolean activated, boolean refreshed) {
    }
}
