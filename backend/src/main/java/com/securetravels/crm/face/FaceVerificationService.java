package com.securetravels.crm.face;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.face.dto.FaceEnrollRequest;
import com.securetravels.crm.face.dto.FaceRosterItemResponse;
import com.securetravels.crm.face.dto.FaceVerificationLogResponse;
import com.securetravels.crm.face.dto.FaceVerifyRequest;
import com.securetravels.crm.face.dto.FaceVerifyResponse;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Webcam face enroll + verify for office teams.
 * Only MANAGER / ADMIN / CEO may use this desk; they enroll and check people in their scope.
 */
@Service
public class FaceVerificationService {

    static final ZoneId ZONE = ZoneId.of("Asia/Kolkata");
    private static final Set<Role> OPERATORS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);
    private static final Set<Role> COMPANY = EnumSet.of(Role.ADMIN, Role.CEO);
    private static final Set<Role> OFFICE_ROLES = EnumSet.of(Role.SALES, Role.OPS, Role.MANAGER);
    private static final Set<String> PURPOSES = Set.of("ENROLL_CHECK", "DESK_CHECK", "IDENTIFY", "ATTENDANCE");
    private static final int MAX_SNAPSHOT_BYTES = 120_000;
    private static final int DESCRIPTOR_DIM = 128;

    private final FaceProfileRepository profiles;
    private final FaceVerificationRepository verifications;
    private final UserRepository users;
    private final ObjectMapper json;

    public FaceVerificationService(FaceProfileRepository profiles, FaceVerificationRepository verifications,
                                   UserRepository users, ObjectMapper json) {
        this.profiles = profiles;
        this.verifications = verifications;
        this.users = users;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<FaceRosterItemResponse> roster(UserPrincipal caller) {
        requireOperator(caller);
        List<User> people = officeInScope(caller);
        Map<UUID, FaceProfile> byUser = profiles.findByUserIdInAndActiveTrue(
                        people.stream().map(User::getId).toList()).stream()
                .collect(Collectors.toMap(FaceProfile::getUserId, Function.identity(), (a, b) -> a));
        return people.stream()
                .map(person -> {
                    FaceProfile profile = byUser.get(person.getId());
                    return new FaceRosterItemResponse(
                            person.getId(),
                            person.getFullName(),
                            person.getEmail(),
                            person.getRole().name(),
                            profile != null,
                            profile != null ? profile.getUpdatedAt() : null,
                            profile != null ? profile.getSampleCount() : 0);
                })
                .sorted(Comparator.comparing(FaceRosterItemResponse::fullName,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    @Transactional
    public FaceRosterItemResponse enroll(UserPrincipal caller, FaceEnrollRequest request) {
        requireOperator(caller);
        User subject = users.findById(request.userId())
                .orElseThrow(() -> new NotFoundException("User not found"));
        assertCanManageSubject(caller, subject);

        List<double[]> samples = request.descriptors().stream().map(this::toDescriptor).toList();
        double[] mean = FaceMath.average(samples);
        byte[] snapshot = decodeSnapshot(request.snapshotJpegBase64());
        Instant now = Instant.now();
        String payload = writeDescriptor(mean);

        FaceProfile profile = profiles.findByUserIdAndActiveTrue(subject.getId()).orElse(null);
        if (profile == null) {
            profile = new FaceProfile(UUID.randomUUID(), subject.getId(), payload, samples.size(),
                    snapshot, caller.id(), now);
        } else {
            profile.replace(payload, samples.size(), snapshot, caller.id(), now);
        }
        profiles.save(profile);

        return new FaceRosterItemResponse(
                subject.getId(), subject.getFullName(), subject.getEmail(), subject.getRole().name(),
                true, profile.getUpdatedAt(), profile.getSampleCount());
    }

    @Transactional
    public void clearEnrollment(UserPrincipal caller, UUID userId) {
        requireOperator(caller);
        User subject = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        assertCanManageSubject(caller, subject);
        FaceProfile profile = profiles.findByUserIdAndActiveTrue(userId)
                .orElseThrow(() -> new NotFoundException("No active face enrollment for that person"));
        profile.deactivate(Instant.now());
        profiles.save(profile);
    }

    @Transactional
    public FaceVerifyResponse verify(UserPrincipal caller, FaceVerifyRequest request) {
        requireOperator(caller);
        String purpose = request.purpose().trim().toUpperCase();
        if (!PURPOSES.contains(purpose)) {
            throw new BadRequestException("Purpose must be DESK_CHECK, IDENTIFY, ATTENDANCE, or ENROLL_CHECK");
        }
        double[] probe = toDescriptor(request.descriptor());
        byte[] snapshot = decodeSnapshot(request.snapshotJpegBase64());
        Instant now = Instant.now();
        BigDecimal threshold = BigDecimal.valueOf(FaceMath.MATCH_THRESHOLD).setScale(6, RoundingMode.HALF_UP);

        if (request.subjectUserId() != null) {
            return verifyOneToOne(caller, request.subjectUserId(), probe, purpose, snapshot,
                    request.loginSessionId(), request.note(), threshold, now);
        }
        return identify(caller, probe, purpose, snapshot, request.loginSessionId(), request.note(), threshold, now);
    }

    @Transactional(readOnly = true)
    public List<FaceVerificationLogResponse> recentLog(UserPrincipal caller, LocalDate day) {
        requireOperator(caller);
        LocalDate date = day != null ? day : LocalDate.now(ZONE);
        Instant from = date.atStartOfDay(ZONE).toInstant();
        Instant to = date.plusDays(1).atStartOfDay(ZONE).toInstant();
        List<FaceVerification> rows = verifications.findBetween(from, to);
        List<FaceVerification> visible;
        if (COMPANY.contains(caller.role())) {
            visible = rows;
        } else {
            Set<UUID> scope = officeInScope(caller).stream().map(User::getId).collect(Collectors.toSet());
            visible = rows.stream()
                    .filter(v -> caller.id().equals(v.getVerifiedBy())
                            || (v.getSubjectUserId() != null && scope.contains(v.getSubjectUserId()))
                            || (v.getMatchedUserId() != null && scope.contains(v.getMatchedUserId())))
                    .toList();
        }
        Map<UUID, User> people = users.findAllById(collectUserIds(visible)).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return visible.stream().map(v -> toLog(v, people)).toList();
    }

    private FaceVerifyResponse verifyOneToOne(UserPrincipal caller, UUID subjectId, double[] probe,
                                              String purpose, byte[] snapshot, UUID loginSessionId,
                                              String note, BigDecimal threshold, Instant now) {
        User subject = users.findById(subjectId).orElseThrow(() -> new NotFoundException("User not found"));
        assertCanManageSubject(caller, subject);
        FaceProfile profile = profiles.findByUserIdAndActiveTrue(subjectId).orElse(null);
        if (profile == null) {
            FaceVerification miss = saveAttempt(null, null, caller.id(), purpose, "NO_TEMPLATE",
                    null, threshold, snapshot, loginSessionId, note, now);
            return toVerify(miss, null);
        }
        double distance = FaceMath.euclidean(probe, readDescriptor(profile.getDescriptorJson()));
        boolean match = FaceMath.isMatch(distance);
        FaceVerification row = saveAttempt(
                subjectId,
                match ? subjectId : null,
                caller.id(),
                purpose,
                match ? "MATCH" : "NO_MATCH",
                BigDecimal.valueOf(distance).setScale(6, RoundingMode.HALF_UP),
                threshold,
                snapshot,
                loginSessionId,
                note,
                now);
        return toVerify(row, match ? subject : null);
    }

    private FaceVerifyResponse identify(UserPrincipal caller, double[] probe, String purpose,
                                        byte[] snapshot, UUID loginSessionId, String note,
                                        BigDecimal threshold, Instant now) {
        List<User> people = officeInScope(caller);
        List<FaceProfile> enrolled = profiles.findByUserIdInAndActiveTrue(
                people.stream().map(User::getId).toList());
        if (enrolled.isEmpty()) {
            FaceVerification miss = saveAttempt(null, null, caller.id(), purpose, "NO_TEMPLATE",
                    null, threshold, snapshot, loginSessionId, "No enrolled office faces in your scope", now);
            return toVerify(miss, null);
        }

        FaceProfile best = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        FaceProfile second = null;
        double secondDistance = Double.POSITIVE_INFINITY;
        for (FaceProfile profile : enrolled) {
            double distance = FaceMath.euclidean(probe, readDescriptor(profile.getDescriptorJson()));
            if (distance < bestDistance) {
                second = best;
                secondDistance = bestDistance;
                best = profile;
                bestDistance = distance;
            } else if (distance < secondDistance) {
                second = profile;
                secondDistance = distance;
            }
        }

        boolean match = best != null && FaceMath.isMatch(bestDistance);
        boolean ambiguous = match && second != null && FaceMath.isMatch(secondDistance)
                && Math.abs(secondDistance - bestDistance) < 0.05;

        String result;
        UUID matchedId = null;
        User matched = null;
        if (ambiguous) {
            result = "AMBIGUOUS";
        } else if (match) {
            result = "MATCH";
            matchedId = best.getUserId();
            matched = users.findById(matchedId).orElse(null);
        } else {
            result = "NO_MATCH";
        }

        FaceVerification row = saveAttempt(
                matchedId,
                matchedId,
                caller.id(),
                purpose,
                result,
                BigDecimal.valueOf(bestDistance).setScale(6, RoundingMode.HALF_UP),
                threshold,
                snapshot,
                loginSessionId,
                note,
                now);
        return toVerify(row, matched);
    }

    private FaceVerification saveAttempt(UUID subjectUserId, UUID matchedUserId, UUID verifiedBy,
                                         String purpose, String result, BigDecimal score,
                                         BigDecimal threshold, byte[] snapshot, UUID loginSessionId,
                                         String note, Instant now) {
        FaceVerification row = new FaceVerification(
                UUID.randomUUID(),
                subjectUserId,
                matchedUserId,
                verifiedBy,
                purpose,
                result,
                score,
                threshold,
                snapshot,
                loginSessionId,
                note,
                now);
        return verifications.save(row);
    }

    private FaceVerifyResponse toVerify(FaceVerification row, User matched) {
        return new FaceVerifyResponse(
                row.getId(),
                row.getSubjectUserId(),
                row.getMatchedUserId(),
                matched != null ? matched.getFullName() : null,
                matched != null ? matched.getEmail() : null,
                row.getPurpose(),
                row.getResult(),
                row.getScore(),
                row.getThresholdUsed(),
                row.getCreatedAt());
    }

    private FaceVerificationLogResponse toLog(FaceVerification row, Map<UUID, User> people) {
        User subject = row.getSubjectUserId() != null ? people.get(row.getSubjectUserId()) : null;
        User matched = row.getMatchedUserId() != null ? people.get(row.getMatchedUserId()) : null;
        User verifier = people.get(row.getVerifiedBy());
        return new FaceVerificationLogResponse(
                row.getId(),
                row.getSubjectUserId(),
                subject != null ? subject.getFullName() : null,
                row.getMatchedUserId(),
                matched != null ? matched.getFullName() : null,
                row.getVerifiedBy(),
                verifier != null ? verifier.getFullName() : null,
                row.getPurpose(),
                row.getResult(),
                row.getScore(),
                row.getSnapshotJpeg() != null && row.getSnapshotJpeg().length > 0,
                row.getCreatedAt());
    }

    private static Set<UUID> collectUserIds(List<FaceVerification> rows) {
        Set<UUID> ids = new java.util.HashSet<>();
        for (FaceVerification row : rows) {
            if (row.getSubjectUserId() != null) ids.add(row.getSubjectUserId());
            if (row.getMatchedUserId() != null) ids.add(row.getMatchedUserId());
            ids.add(row.getVerifiedBy());
        }
        return ids;
    }

    private List<User> officeInScope(UserPrincipal caller) {
        if (COMPANY.contains(caller.role())) {
            return users.findByIsActiveTrueAndRoleIn(OFFICE_ROLES).stream()
                    .sorted(Comparator.comparing(User::getFullName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                    .toList();
        }
        // Managers: themselves + active reports in office roles
        List<User> rows = new ArrayList<>();
        users.findById(caller.id()).ifPresent(rows::add);
        users.findByReportsToOrderByFullNameAsc(caller.id()).stream()
                .filter(u -> u.isActive() && OFFICE_ROLES.contains(u.getRole()))
                .forEach(rows::add);
        return rows;
    }

    private void assertCanManageSubject(UserPrincipal caller, User subject) {
        if (!subject.isActive()) {
            throw new BadRequestException("That user is inactive");
        }
        if (!OFFICE_ROLES.contains(subject.getRole())) {
            throw new BadRequestException("Face enrollment is for office desk roles (Sales, Ops, Manager)");
        }
        if (COMPANY.contains(caller.role())) {
            return;
        }
        boolean allowed = officeInScope(caller).stream().anyMatch(u -> u.getId().equals(subject.getId()));
        if (!allowed) {
            throw new ForbiddenException("You cannot manage face enrollment for that person");
        }
    }

    private static void requireOperator(UserPrincipal caller) {
        if (!OPERATORS.contains(caller.role())) {
            throw new ForbiddenException("Only managers, admins, and the CEO can use face verification");
        }
    }

    private double[] toDescriptor(List<Double> values) {
        if (values == null || values.size() != DESCRIPTOR_DIM) {
            throw new BadRequestException("Face descriptor must be exactly 128 numbers");
        }
        double[] out = new double[DESCRIPTOR_DIM];
        for (int i = 0; i < DESCRIPTOR_DIM; i++) {
            Double v = values.get(i);
            if (v == null || !Double.isFinite(v)) {
                throw new BadRequestException("Face descriptor contains invalid numbers");
            }
            out[i] = v;
        }
        return out;
    }

    private String writeDescriptor(double[] values) {
        try {
            return json.writeValueAsString(values);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Could not store face descriptor");
        }
    }

    private double[] readDescriptor(String payload) {
        try {
            List<Double> values = json.readValue(payload, new TypeReference<>() {});
            return toDescriptor(values);
        } catch (JsonProcessingException e) {
            throw new BadRequestException("Stored face descriptor is corrupt");
        }
    }

    private static byte[] decodeSnapshot(String base64) {
        if (base64 == null || base64.isBlank()) {
            return null;
        }
        String raw = base64.trim();
        int comma = raw.indexOf(',');
        if (raw.startsWith("data:") && comma > 0) {
            raw = raw.substring(comma + 1);
        }
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(raw);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Snapshot must be valid base64 JPEG");
        }
        if (bytes.length > MAX_SNAPSHOT_BYTES) {
            throw new BadRequestException("Snapshot is too large — capture a smaller webcam frame");
        }
        return bytes;
    }
}
