package com.securetravels.crm.automation.runtime;

import com.securetravels.crm.common.config.AppProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AutomationGuardsMigrateShadowTest {

    @Test
    void migrateTemplatesDoNotForceDryRunAfterCutover() {
        AppProperties props = new AppProperties();
        props.getAutomation().setDryRunEnabled(false);
        props.getAutomation().setMigrateShadowEnabled(true);
        props.getAutomation().setLegacyEffectsEnabled(false);

        AutomationGuards guards = new AutomationGuards(props);

        assertThat(guards.migrateShadow()).isTrue();
        assertThat(guards.dryRun()).isFalse();
        assertThat(guards.legacyEffects()).isFalse();
    }

    @Test
    void dryRunAloneStillWorks() {
        AppProperties props = new AppProperties();
        props.getAutomation().setDryRunEnabled(true);
        props.getAutomation().setMigrateShadowEnabled(false);

        AutomationGuards guards = new AutomationGuards(props);

        assertThat(guards.dryRun()).isTrue();
    }

    @Test
    void cutoverDefaultsMatchApprovedProduction() {
        AppProperties props = new AppProperties();
        assertThat(props.getAutomation().isLegacyEffectsEnabled()).isFalse();
        assertThat(props.getAutomation().isDryRunEnabled()).isFalse();
        assertThat(props.getAutomation().isMigrateShadowEnabled()).isTrue();
        assertThat(props.getZapier().isEventsEnabled()).isFalse();
    }
}
