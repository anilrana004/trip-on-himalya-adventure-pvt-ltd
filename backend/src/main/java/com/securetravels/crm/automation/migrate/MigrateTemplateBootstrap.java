package com.securetravels.crm.automation.migrate;

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
 * When {@code app.automation.migrate-shadow-enabled=true}, ensure M1–M9
 * workflow templates exist and are ACTIVE. Live vs dry-run is controlled by
 * {@code dry-run-enabled}; legacy hard-coded effects by {@code legacy-effects-enabled}.
 */
@Component
@Order(40)
public class MigrateTemplateBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(MigrateTemplateBootstrap.class);

    private final AppProperties props;
    private final WorkflowService workflows;

    public MigrateTemplateBootstrap(AppProperties props, WorkflowService workflows) {
        this.props = props;
        this.workflows = workflows;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.getAutomation().isMigrateShadowEnabled()) {
            log.info("[automation] MIGRATE shadow disabled; skipping template bootstrap");
            return;
        }
        int activated = 0;
        for (MigrateWorkflowTemplates.Template template : MigrateWorkflowTemplates.all()) {
            try {
                if (ensureActive(template)) {
                    activated++;
                }
            } catch (Exception ex) {
                log.warn("[automation] MIGRATE template {} bootstrap failed: {}",
                        template.slug(), ex.getMessage());
            }
        }
        log.info("[automation] MIGRATE templates ready — {} active (legacyEffects={} dryRun={})",
                activated,
                props.getAutomation().isLegacyEffectsEnabled(),
                props.getAutomation().isDryRunEnabled());
    }

    private boolean ensureActive(MigrateWorkflowTemplates.Template template) {
        Workflow workflow = workflows.findBySlug(template.slug()).orElseGet(() ->
                workflows.createWorkflow(template.slug(), template.name(), template.description(), null));

        WorkflowVersion active = workflows.activeVersion(workflow.getId()).orElse(null);
        if (active != null) {
            log.debug("[automation] MIGRATE template {} already ACTIVE v{}",
                    template.slug(), active.getVersionNumber());
            return true;
        }

        workflows.saveDraft(workflow.getId(), template.definition(), null);
        workflows.activate(workflow.getId(), null);
        log.info("[automation] MIGRATE template {} activated (shadow)", template.slug());
        return true;
    }
}
