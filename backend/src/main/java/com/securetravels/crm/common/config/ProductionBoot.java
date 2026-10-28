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
 *
 * <p>Also reads {@code SPRING_PROFILES_ACTIVE} / {@code System.getenv} because
 * {@link org.springframework.core.env.Environment#getActiveProfiles()} can still
 * be empty inside an {@code EnvironmentPostProcessor}, which previously skipped
 * the production secrets gate until a later {@code ApplicationRunner} crashed
 * the already-started Tomcat.
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
        if (test) return false;
        if (prod) return true;

        if (profileListContains(env.getProperty("spring.profiles.active"), "test")
                || profileListContains(System.getenv("SPRING_PROFILES_ACTIVE"), "test")) {
            return false;
        }
        if (profileListContains(env.getProperty("spring.profiles.active"), "prod")
                || profileListContains(System.getenv("SPRING_PROFILES_ACTIVE"), "prod")) {
            return true;
        }

        return present(env, "RAILWAY_ENVIRONMENT")
                || present(env, "RAILWAY_PROJECT_ID")
                || present(env, "RAILWAY_ENVIRONMENT_NAME")
                || getenvPresent("RAILWAY_ENVIRONMENT")
                || getenvPresent("RAILWAY_PROJECT_ID")
                || getenvPresent("RAILWAY_ENVIRONMENT_NAME");
    }

    /** The flag alone is not enough. A production boot ignores it. */
    public static boolean allowDemoSeed(boolean requested, boolean productionBoot) {
        return requested && !productionBoot;
    }

    private static boolean profileListContains(String list, String profile) {
        if (list == null || list.isBlank()) {
            return false;
        }
        for (String part : list.split(",")) {
            if (profile.equals(part.trim())) {
                return true;
            }
        }
        return false;
    }

    private static boolean present(Environment env, String key) {
        String value = env.getProperty(key);
        return value != null && !value.isBlank();
    }

    private static boolean getenvPresent(String key) {
        String value = System.getenv(key);
        return value != null && !value.isBlank();
    }
}
