package com.securetravels.crm.common.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

import static org.assertj.core.api.Assertions.assertThat;

class ProductionBootTest {

    @Test
    @DisplayName("prod profile is a production boot even without Railway variables")
    void prodProfile() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        assertThat(ProductionBoot.detected(env)).isTrue();
    }

    @Test
    @DisplayName("Railway variables count even when the prod profile was forgotten")
    void railwayWithoutProfile() {
        MockEnvironment env = new MockEnvironment();
        env.setProperty("RAILWAY_PROJECT_ID", "proj");
        assertThat(ProductionBoot.detected(env)).isTrue();
    }

    @Test
    @DisplayName("the test profile is not a production boot")
    void testProfileIgnoresRailwayVars() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("test");
        env.setProperty("RAILWAY_PROJECT_ID", "proj");
        assertThat(ProductionBoot.detected(env)).isFalse();
    }

    @Test
    @DisplayName("a local boot with no profile is not production")
    void local() {
        assertThat(ProductionBoot.detected(new MockEnvironment())).isFalse();
    }

    @Test
    @DisplayName("demo users are seeded only when asked and the boot is not production")
    void demoSeedRule() {
        assertThat(ProductionBoot.allowDemoSeed(true, false)).isTrue();
        assertThat(ProductionBoot.allowDemoSeed(true, true)).isFalse();
        assertThat(ProductionBoot.allowDemoSeed(false, false)).isFalse();
        assertThat(ProductionBoot.allowDemoSeed(false, true)).isFalse();
    }
}
