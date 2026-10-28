package com.securetravels.crm.auth;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class MergedSecondsTest {

    @Test
    void overlappingSpansCountOnce() {
        List<long[]> spans = new ArrayList<>();
        spans.add(new long[]{100, 200});
        spans.add(new long[]{150, 250});
        assertThat(PresenceService.mergedSeconds(spans)).isEqualTo(150L);
    }

    @Test
    void separateSpansAddUp() {
        List<long[]> spans = new ArrayList<>();
        spans.add(new long[]{0, 60});
        spans.add(new long[]{120, 180});
        assertThat(PresenceService.mergedSeconds(spans)).isEqualTo(120L);
    }
}
