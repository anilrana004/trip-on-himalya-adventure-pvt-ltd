package com.securetravels.crm.automation.runtime;

import org.springframework.stereotype.Component;

/**
 * Cutover gate for hard-coded MIGRATE side effects. When legacy is off, the
 * workflow engine owns task/notify/send effects; CORE paths (ops handoff row,
 * payment overdue status + ops mirror, scarcity latch, min-group alerts) stay
 * in their services.
 */
@Component
public class LegacyAutomationGate {

    private final AutomationGuards guards;

    public LegacyAutomationGate(AutomationGuards guards) {
        this.guards = guards;
    }

    public boolean enabled() {
        return guards.legacyEffects();
    }
}
