package com.securetravels.crm.auth;

import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.TooManyRequestsException;
import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Refill;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Production login lockout (Salesforce / Zoho style): count <b>failed</b>
 * passwords only, keyed by email and by client IP separately.
 *
 * <ul>
 *   <li>Per-email — stops credential stuffing on one desk account without
 *       locking every salesperson behind the same office NAT.</li>
 *   <li>Per-IP — stops a single source flooding many emails.</li>
 *   <li>Successful sign-in clears that email's failure window so typos
 *       do not strand a CEO after they finally enter the Railway secret.</li>
 * </ul>
 *
 * <p>In-memory buckets are correct for a single Railway API instance. Multi-
 * instance lockout needs a shared store (Redis) — same API surface later.
 */
@Service
public class LoginThrottleService {

    private static final int MAX_BUCKETS = 4096;

    private final Map<String, Bucket> buckets = java.util.Collections.synchronizedMap(
            new LinkedHashMap<>(32, 0.75f, true) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<String, Bucket> eldest) {
                    return size() > MAX_BUCKETS;
                }
            });

    private final AppProperties props;

    public LoginThrottleService(AppProperties props) {
        this.props = props;
    }

    public void assertAllowed(String rawEmail, String clientIp) {
        String emailKey = emailKey(rawEmail);
        String ipKey = ipKey(clientIp);

        long emailWait = nanosToWaitIfEmpty(emailKey, emailLimit());
        if (emailWait > 0) {
            throw locked("Too many failed sign-in attempts for this account. Try again in "
                    + humanWait(emailWait) + ".", emailWait);
        }
        long ipWait = nanosToWaitIfEmpty(ipKey, ipLimit());
        if (ipWait > 0) {
            throw locked("Too many failed sign-in attempts from this network. Try again in "
                    + humanWait(ipWait) + ".", ipWait);
        }
    }

    public void onFailure(String rawEmail, String clientIp) {
        consume(emailKey(rawEmail), emailLimit());
        consume(ipKey(clientIp), ipLimit());
    }

    /** Clears the account failure window after a correct password. */
    public void onSuccess(String rawEmail, String clientIp) {
        synchronized (buckets) {
            buckets.remove(emailKey(rawEmail));
            // IP window stays — a botnet that guessed one password must not
            // reset the flood budget for every other email on that IP.
        }
    }

    private long nanosToWaitIfEmpty(String key, Limit limit) {
        synchronized (buckets) {
            Bucket bucket = buckets.computeIfAbsent(key, k -> newBucket(limit));
            if (bucket.getAvailableTokens() > 0) {
                return 0L;
            }
            var probe = bucket.estimateAbilityToConsume(1);
            return Math.max(1L, probe.getNanosToWaitForRefill());
        }
    }

    private void consume(String key, Limit limit) {
        synchronized (buckets) {
            Bucket bucket = buckets.computeIfAbsent(key, k -> newBucket(limit));
            bucket.tryConsume(1);
        }
    }

    private Bucket newBucket(Limit limit) {
        return Bucket.builder()
                .addLimit(Bandwidth.classic(
                        limit.capacity(),
                        Refill.greedy(limit.capacity(), Duration.ofMinutes(limit.windowMinutes()))))
                .build();
    }

    private Limit emailLimit() {
        var cfg = props.getLoginRateLimit();
        return new Limit(cfg.getMaxFailuresPerEmail(), cfg.getWindowMinutes());
    }

    private Limit ipLimit() {
        var cfg = props.getLoginRateLimit();
        return new Limit(cfg.getMaxFailuresPerIp(), cfg.getWindowMinutes());
    }

    private static String emailKey(String rawEmail) {
        String email = rawEmail == null ? "" : rawEmail.trim().toLowerCase(Locale.ROOT);
        return "email:" + (email.isEmpty() ? "_" : email);
    }

    private static String ipKey(String clientIp) {
        String ip = clientIp == null || clientIp.isBlank() ? "unknown" : clientIp.trim();
        return "ip:" + ip;
    }

    private static TooManyRequestsException locked(String message, long nanosToWait) {
        long seconds = Math.max(1L, (nanosToWait + 999_999_999L) / 1_000_000_000L);
        return new TooManyRequestsException(message, seconds);
    }

    private static String humanWait(long nanosToWait) {
        long seconds = Math.max(1L, (nanosToWait + 999_999_999L) / 1_000_000_000L);
        if (seconds < 60) {
            return seconds + " second" + (seconds == 1 ? "" : "s");
        }
        long minutes = (seconds + 59) / 60;
        return minutes + " minute" + (minutes == 1 ? "" : "s");
    }

    private record Limit(long capacity, long windowMinutes) {}
}
