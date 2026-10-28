package com.securetravels.crm.trip.faq;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class TripFaqService {

    private static final Set<Role> WRITERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final TripFaqRepository faqs;
    private final TripRepository trips;
    private final AuditService auditService;

    public TripFaqService(TripFaqRepository faqs, TripRepository trips, AuditService auditService) {
        this.faqs = faqs;
        this.trips = trips;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TripFaqResponse> list(UserPrincipal caller) {
        boolean staff = WRITERS.contains(caller.role());
        Map<UUID, String> names = new HashMap<>();
        return faqs.findTop500ByOrderByCreatedAtDesc().stream()
                .filter(faq -> staff || faq.isPublished())
                .map(faq -> toResponse(faq, names))
                .toList();
    }

    @Transactional
    public TripFaqResponse create(TripFaqWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        Trip trip = requireTrip(request.tripId());
        TripFaq faq = new TripFaq(trip.getId(), cleanQuestion(request.question()), cleanAnswer(request.answer()),
                request.published() == null || request.published());
        faq.setCreatedBy(caller.id());
        TripFaq saved = faqs.save(faq);
        auditService.record("TRIP_FAQ", saved.getId(), AuditAction.CREATE, "question", null, saved.getQuestion());
        return toResponse(saved, new HashMap<>());
    }

    @Transactional
    public TripFaqResponse update(UUID id, TripFaqWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        TripFaq faq = faqs.findById(id).orElseThrow(() -> new NotFoundException("FAQ not found: " + id));
        if (!faq.getTripId().equals(request.tripId())) {
            throw new BadRequestException("An FAQ stays on the trek it was written for");
        }
        faq.setQuestion(cleanQuestion(request.question()));
        faq.setAnswer(cleanAnswer(request.answer()));
        if (request.published() != null) {
            faq.setPublished(request.published());
        }
        faqs.save(faq);
        auditService.record("TRIP_FAQ", faq.getId(), AuditAction.UPDATE, "question", null, faq.getQuestion());
        return toResponse(faq, new HashMap<>());
    }

    @Transactional
    public void delete(UUID id, UserPrincipal caller) {
        requireWriter(caller.role());
        TripFaq faq = faqs.findById(id).orElseThrow(() -> new NotFoundException("FAQ not found: " + id));
        faqs.delete(faq);
        auditService.record("TRIP_FAQ", id, AuditAction.DELETE, "question", faq.getQuestion(), null);
    }

    @Transactional
    public TripFaqCopyResponse copy(TripFaqCopyRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        if (request.fromTripId().equals(request.toTripId())) {
            throw new BadRequestException("Choose a different trek to copy from");
        }
        requireTrip(request.fromTripId());
        requireTrip(request.toTripId());
        Set<String> existing = faqs.findByTripIdOrderByCreatedAtAsc(request.toTripId()).stream()
                .map(faq -> faq.getQuestion().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        int copied = 0;
        int skipped = 0;
        for (TripFaq source : faqs.findByTripIdOrderByCreatedAtAsc(request.fromTripId())) {
            if (!source.isPublished()) {
                skipped++;
                continue;
            }
            if (!existing.add(source.getQuestion().toLowerCase(Locale.ROOT))) {
                skipped++;
                continue;
            }
            TripFaq copy = new TripFaq(request.toTripId(), source.getQuestion(), source.getAnswer(), true);
            copy.setCreatedBy(caller.id());
            faqs.save(copy);
            copied++;
        }
        return new TripFaqCopyResponse(copied, skipped);
    }

    private TripFaqResponse toResponse(TripFaq faq, Map<UUID, String> names) {
        String tripName = names.computeIfAbsent(faq.getTripId(),
                id -> trips.findById(id).map(Trip::getName).orElse(null));
        return new TripFaqResponse(faq.getId(), faq.getTripId(), tripName, faq.getQuestion(), faq.getAnswer(),
                faq.isPublished(), faq.getCreatedAt());
    }

    private Trip requireTrip(UUID id) {
        return trips.findById(id).orElseThrow(() -> new NotFoundException("Trek not found: " + id));
    }

    private static String cleanQuestion(String raw) {
        String text = XssSanitizer.text(raw == null ? "" : raw.trim());
        if (text == null || text.isBlank()) {
            throw new BadRequestException("Question is required");
        }
        return text;
    }

    private static String cleanAnswer(String raw) {
        String text = XssSanitizer.text(raw == null ? "" : raw.trim());
        if (text == null || text.isBlank()) {
            throw new BadRequestException("Answer is required");
        }
        return text;
    }

    private static void requireWriter(Role role) {
        if (!WRITERS.contains(role)) {
            throw new ForbiddenException("This role (" + role + ") cannot edit trek FAQs");
        }
    }
}
