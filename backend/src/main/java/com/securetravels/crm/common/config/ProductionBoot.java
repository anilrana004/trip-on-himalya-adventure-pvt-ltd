package com.securetravels.crm.common.config;

import org.springframework.core.env.Environment;

/**
 * A boot that must not accept demo data or checked-in secrets.
 *
 * <p>The {@code prod} profile counts. So does any Railway process, because
 * {@code railway.toml} can be deployed without that profile and the Java
 * default used to seed {@code admin123}. The {@code test} profile is exempt
 * so a developer shell that exports {@code RAILWAY_PROJECT_ID} does not fail
 * the suite.
 */
public final class ProductionBoot {

    private ProductionBoot() {
    }

    public static boolean detected(Environment env) {
        boolean prod = false;
        boolean test = false;
        for (String profile : env.getActiveProfiles()) {
            if ("prod".equals(profile)) prod = true;
            if ("test".equals(profile)) test = true;
        }
        if (prod) return true;
        if (test) return false;
        return present(env, "RAILWAY_ENVIRONMENT")
                || present(env, "RAILWAY_PROJECT_ID")
                || present(env, "RAILWAY_ENVIRONMENT_NAME");
    }

    /** The flag alone is not enough. A production boot ignores it. */
    public static boolean allowDemoSeed(boolean requested, boolean productionBoot) {
        return requested && !productionBoot;
    }

    private static boolean present(Environment env, String key) {
        String value = env.getProperty(key);
        return value != null && !value.isBlank();
    }
}
