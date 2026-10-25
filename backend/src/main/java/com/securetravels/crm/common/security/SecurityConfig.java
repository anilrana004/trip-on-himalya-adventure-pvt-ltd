package com.securetravels.crm.common.security;

import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.dto.ApiError;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

/**
 * Role hierarchy is flat (SALES/OPS/MANAGER/ADMIN/CEO). Authorization is
 * enforced twice: @PreAuthorize at the controller AND ownership checks in
 * the service layer (security requirement 6).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private static final String[] PERMITTED = {
            "/api/auth/login",
            "/api/auth/refresh",
            "/api/auth/logout",
            "/api/webhook/**",
            // Phase 5 Module 2. The SES and SMS-gateway webhooks are
            // unauthenticated by necessity (the provider holds no JWT), so they
            // are reachable without a token and MUST verify an HMAC signature
            // themselves - see EmailWebhookService / SmsWebhookService, which
            // reject a missing or wrong signature rather than defaulting open.
            "/api/v1/webhooks/email/**",
            "/api/v1/webhooks/sms/**",
            "/actuator/health",
            // Dev and test only. permittedMatchers() drops these when the prod
            // profile is active. application-prod.yml also stops exposing them.
            "/actuator/prometheus",
            "/api/health",
            "/v3/api-docs/**",
            "/docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html"
    };

    private final JwtAuthenticationFilter jwtFilter;
    private final RateLimitingFilter rateLimitFilter;
    private final AppProperties props;
    private final ObjectMapper objectMapper;
    private final Environment environment;

    public SecurityConfig(JwtAuthenticationFilter jwtFilter, RateLimitingFilter rateLimitFilter,
                          AppProperties props, ObjectMapper objectMapper, Environment environment) {
        this.jwtFilter = jwtFilter;
        this.rateLimitFilter = rateLimitFilter;
        this.props = props;
        this.objectMapper = objectMapper;
        this.environment = environment;
    }

    /** Prod does not publish metrics or the API map without a logged-in user. */
    static String[] permittedMatchers(boolean productionProfile) {
        if (!productionProfile) {
            return PERMITTED;
        }
        return Arrays.stream(PERMITTED)
                .filter(path -> !isStaffOnlySurface(path))
                .toArray(String[]::new);
    }

    static boolean isStaffOnlySurface(String path) {
        return path.startsWith("/actuator/prometheus")
                || path.startsWith("/v3/api-docs")
                || path.startsWith("/docs")
                || path.startsWith("/swagger-ui");
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(permittedMatchers(productionProfile())).permitAll()
                        .requestMatchers(
                                "/api/auth/**",
                                "/api/operations",
                                "/api/operations/**",
                                "/api/vendors",
                                "/api/vendors/**",
                                "/api/notifications",
                                "/api/notifications/**"
                        ).authenticated()
                        .anyRequest().access((authentication, context) -> {
                            Authentication current = authentication.get();
                            if (current == null || !current.isAuthenticated()) {
                                return new AuthorizationDecision(false);
                            }
                            boolean partner = current.getAuthorities().stream().anyMatch(authority ->
                                    "ROLE_TRANSPORT".equals(authority.getAuthority())
                                            || "ROLE_VENDOR".equals(authority.getAuthority()));
                            return new AuthorizationDecision(!partner);
                        }))
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint((req, res, ex) -> {
                            res.setStatus(HttpStatus.UNAUTHORIZED.value());
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            res.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
                            objectMapper.writeValue(res.getOutputStream(),
                                    new ApiError(HttpStatus.UNAUTHORIZED.value(), "UNAUTHORIZED",
                                            "Authentication required"));
                        })
                        .accessDeniedHandler((req, res, ex) -> {
                            res.setStatus(HttpStatus.FORBIDDEN.value());
                            res.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            objectMapper.writeValue(res.getOutputStream(),
                                    new ApiError(HttpStatus.FORBIDDEN.value(), "FORBIDDEN",
                                            "You do not have permission for this action"));
                        }))
                .addFilterBefore(rateLimitFilter, UsernamePasswordAuthenticationFilter.class)
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    private boolean productionProfile() {
        return Arrays.stream(environment.getActiveProfiles()).anyMatch("prod"::equals);
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        // Use patterns (supports http://localhost:*) so Next.js rewrites that
        // forward the browser Origin do not 403 with "Invalid CORS request".
        List<String> origins = props.getCors().getAllowedOrigins();
        if (origins == null || origins.isEmpty()) {
            cfg.setAllowedOriginPatterns(List.of("http://localhost:*", "http://127.0.0.1:*"));
        } else {
            boolean hasWildcard = origins.stream().anyMatch(o -> o.contains("*"));
            if (hasWildcard) {
                cfg.setAllowedOriginPatterns(origins);
            } else {
                cfg.setAllowedOrigins(origins);
            }
        }
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setExposedHeaders(List.of("Retry-After", "Location"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }
}