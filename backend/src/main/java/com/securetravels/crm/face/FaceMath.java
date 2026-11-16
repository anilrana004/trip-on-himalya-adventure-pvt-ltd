package com.securetravels.crm.face;

/** Euclidean match helpers for face-api 128-d descriptors. */
public final class FaceMath {

    /** face-api FaceRecognitionNet: distances under this are the same person. */
    public static final double MATCH_THRESHOLD = 0.55;

    private FaceMath() {
    }

    public static double euclidean(double[] a, double[] b) {
        if (a == null || b == null || a.length == 0 || a.length != b.length) {
            throw new IllegalArgumentException("Descriptors must be equal non-empty length");
        }
        double sum = 0;
        for (int i = 0; i < a.length; i++) {
            double d = a[i] - b[i];
            sum += d * d;
        }
        return Math.sqrt(sum);
    }

    public static double[] average(java.util.List<double[]> samples) {
        if (samples == null || samples.isEmpty()) {
            throw new IllegalArgumentException("Need at least one descriptor sample");
        }
        int dim = samples.get(0).length;
        double[] mean = new double[dim];
        for (double[] sample : samples) {
            if (sample.length != dim) {
                throw new IllegalArgumentException("All descriptors must share the same length");
            }
            for (int i = 0; i < dim; i++) {
                mean[i] += sample[i];
            }
        }
        double n = samples.size();
        for (int i = 0; i < dim; i++) {
            mean[i] /= n;
        }
        return mean;
    }

    public static boolean isMatch(double distance) {
        return distance <= MATCH_THRESHOLD;
    }
}
