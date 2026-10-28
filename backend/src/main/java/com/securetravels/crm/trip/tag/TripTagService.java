package com.securetravels.crm.trip.tag;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.trip.tag.TripTag.Kind;
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
public class TripTagService {

    private static final int MAX_TAGS = 8;
    private static final int MAX_ON_CARD = 3;
    private static final Set<Role> WRITERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final TripTagRepository tags;
    private final TripRepository trips;
    private final AuditService auditService;

    public TripTagService(TripTagRepository tags, TripRepository trips, AuditService auditService) {
        this.tags = tags;
        this.trips = trips;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TripTagResponse> list() {
        Map<UUID, String> names = new HashMap<>();
        return tags.findTop800ByOrderByCreatedAtDesc().stream()
                .map(tag -> toResponse(tag, names))
                .toList();
    }

    @Transactional
    public TripTagResponse create(TripTagWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        Trip trip = requireTrip(request.tripId());
        List<TripTag> existing = tags.findByTripIdOrderByCreatedAtAsc(trip.getId());
        String label = cleanLabel(request.label());
        boolean onCard = Boolean.TRUE.equals(request.onCard());
        assertRoom(existing, null, label, onCard);
        TripTag tag = new TripTag(trip.getId(), label, request.kind(), onCard);
        tag.setCreatedBy(caller.id());
        TripTag saved = tags.save(tag);
        auditService.record("TRIP_TAG", saved.getId(), AuditAction.CREATE, "label", null, saved.getLabel());
        return toResponse(saved, new HashMap<>());
    }

    @Transactional
    public TripTagResponse update(UUID id, TripTagWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        TripTag tag = tags.findById(id).orElseThrow(() -> new NotFoundException("Tag not found: " + id));
        if (!tag.getTripId().equals(request.tripId())) {
            throw new BadRequestException("A tag stays on the trek it was written for");
        }
        List<TripTag> existing = tags.findByTripIdOrderByCreatedAtAsc(tag.getTripId());
        String label = cleanLabel(request.label());
        boolean onCard = request.onCard() == null ? tag.isOnCard() : request.onCard();
        assertRoom(existing, tag.getId(), label, onCard);
        tag.setLabel(label);
        tag.setKind(request.kind());
        tag.setOnCard(onCard);
        tags.save(tag);
        auditService.record("TRIP_TAG", tag.getId(), AuditAction.UPDATE, "label", null, tag.getLabel());
        return toResponse(tag, new HashMap<>());
    }

    @Transactional
    public void delete(UUID id, UserPrincipal caller) {
        requireWriter(caller.role());
        TripTag tag = tags.findById(id).orElseThrow(() -> new NotFoundException("Tag not found: " + id));
        tags.delete(tag);
        auditService.record("TRIP_TAG", id, AuditAction.DELETE, "label", tag.getLabel(), null);
    }

    @Transactional
    public TripTagCopyResponse copy(TripTagCopyRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        if (request.fromTripId().equals(request.toTripId())) {
            throw new BadRequestException("Choose a different trek to copy from");
        }
        requireTrip(request.fromTripId());
        requireTrip(request.toTripId());
        List<TripTag> target = tags.findByTripIdOrderByCreatedAtAsc(request.toTripId());
        Set<String> labels = target.stream()
                .map(tag -> tag.getLabel().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        int copied = 0;
        int skipped = 0;
        for (TripTag source : tags.findByTripIdOrderByCreatedAtAsc(request.fromTripId())) {
            if (!labels.add(source.getLabel().toLowerCase(Locale.ROOT)) || target.size() >= MAX_TAGS) {
                skipped++;
                continue;
            }
            long shown = target.stream().filter(TripTag::isOnCard).count();
            boolean onCard = source.isOnCard() && shown < MAX_ON_CARD;
            TripTag copy = new TripTag(request.toTripId(), source.getLabel(), source.getKind(), onCard);
            copy.setCreatedBy(caller.id());
            target.add(tags.save(copy));
            copied++;
        }
        return new TripTagCopyResponse(copied, skipped);
    }

    private void assertRoom(List<TripTag> existing, UUID self, String label, boolean onCard) {
        boolean duplicate = existing.stream()
                .filter(tag -> self == null || !tag.getId().equals(self))
                .anyMatch(tag -> tag.getLabel().equalsIgnoreCase(label));
        if (duplicate) {
            throw new BadRequestException("This trek already has that tag");
        }
        long others = existing.stream().filter(tag -> self == null || !tag.getId().equals(self)).count();
        if (others >= MAX_TAGS) {
            throw new BadRequestException("A trek holds at most 8 tags");
        }
        if (onCard) {
            long shown = existing.stream()
                    .filter(TripTag::isOnCard)
                    .filter(tag -> self == null || !tag.getId().equals(self))
                    .count();
            if (shown >= MAX_ON_CARD) {
                throw new BadRequestException("Three tags already show on the trek card. Take one off the card first.");
            }
        }
    }

    private TripTagResponse toResponse(TripTag tag, Map<UUID, String> names) {
        String tripName = names.computeIfAbsent(tag.getTripId(),
                id -> trips.findById(id).map(Trip::getName).orElse(null));
        return new TripTagResponse(tag.getId(), tag.getTripId(), tripName, tag.getLabel(), tag.getKind(),
                tag.isOnCard(), tag.getCreatedAt());
    }

    private Trip requireTrip(UUID id) {
        return trips.findById(id).orElseThrow(() -> new NotFoundException("Trek not found: " + id));
    }

    private static String cleanLabel(String raw) {
        String text = XssSanitizer.text(raw == null ? "" : raw.trim().replaceAll("\\s+", " "));
        if (text == null || text.length() < 2) {
            throw new BadRequestException("A tag needs at least 2 characters");
        }
        if (text.length() > 40) {
            throw new BadRequestException("Keep a tag to 40 characters");
        }
        return text;
    }

    private static void requireWriter(Role role) {
        if (!WRITERS.contains(role)) {
            throw new ForbiddenException("This role (" + role + ") cannot edit trek tags");
        }
    }
}
