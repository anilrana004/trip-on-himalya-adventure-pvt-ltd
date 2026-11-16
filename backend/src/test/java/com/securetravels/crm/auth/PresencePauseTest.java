package com.securetravels.crm.auth;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class PresencePauseTest {

    @Test
    void awayWhenLatestCloseWasPause() {
        LoginSession older = new LoginSession(UUID.randomUUID(), UUID.randomUUID(), Instant.parse("2026-11-16T03:00:00Z"));
        older.close(Instant.parse("2026-11-16T04:00:00Z"), "LOGOUT");
        LoginSession pause = new LoginSession(UUID.randomUUID(), older.getUserId(), Instant.parse("2026-11-16T05:00:00Z"));
        pause.close(Instant.parse("2026-11-16T06:00:00Z"), "PAUSE");

        assertThat(PresenceService.isAway(List.of(older, pause))).isTrue();
    }

    @Test
    void notAwayAfterRealLogout() {
        LoginSession pause = new LoginSession(UUID.randomUUID(), UUID.randomUUID(), Instant.parse("2026-11-16T05:00:00Z"));
        pause.close(Instant.parse("2026-11-16T06:00:00Z"), "PAUSE");
        LoginSession out = new LoginSession(UUID.randomUUID(), pause.getUserId(), Instant.parse("2026-11-16T07:00:00Z"));
        out.close(Instant.parse("2026-11-16T08:00:00Z"), "LOGOUT");

        assertThat(PresenceService.isAway(List.of(pause, out))).isFalse();
    }

    @Test
    void pauseThenResumeSpansAddWithoutOverlapCheat() {
        // 1h work + 30m away + 1h work = 2h counted
        List<long[]> spans = List.of(
                new long[]{0, 3600},
                new long[]{5400, 9000}
        );
        assertThat(PresenceService.mergedSeconds(new java.util.ArrayList<>(spans))).isEqualTo(7200L);
    }
}
