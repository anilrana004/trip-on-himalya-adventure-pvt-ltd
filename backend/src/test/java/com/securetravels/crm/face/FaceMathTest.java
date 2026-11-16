package com.securetravels.crm.face;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class FaceMathTest {

    @Test
    void identicalDescriptorsMatch() {
        double[] a = new double[128];
        for (int i = 0; i < 128; i++) a[i] = i * 0.01;
        assertThat(FaceMath.euclidean(a, a)).isEqualTo(0.0);
        assertThat(FaceMath.isMatch(0.0)).isTrue();
    }

    @Test
    void farDescriptorsDoNotMatch() {
        double[] a = new double[128];
        double[] b = new double[128];
        for (int i = 0; i < 128; i++) {
            a[i] = 0;
            b[i] = 1;
        }
        double distance = FaceMath.euclidean(a, b);
        assertThat(distance).isGreaterThan(FaceMath.MATCH_THRESHOLD);
        assertThat(FaceMath.isMatch(distance)).isFalse();
    }

    @Test
    void averageCentersSamples() {
        double[] a = new double[128];
        double[] b = new double[128];
        a[0] = 0;
        b[0] = 2;
        double[] mean = FaceMath.average(List.of(a, b));
        assertThat(mean[0]).isEqualTo(1.0);
    }
}
