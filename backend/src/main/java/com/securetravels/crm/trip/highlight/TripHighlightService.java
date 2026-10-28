package com.securetravels.crm.trip.highlight;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.trip.highlight.TripHighlight.Kind;
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
public class TripHighlightService {

    private static final int MAX_CHIPS = 8;
    private static final int MAX_ON_CARD = 3;
    private static final Set<Role> WRITERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);

    private final TripHighlightRepository highlights;
    private final TripRepository trips;
    private final AuditService auditService;

    public TripHighlightService(TripHighlightRepository highlights, TripRepository trips, AuditService auditService) {
        this.highlights = highlights;
        this.trips = trips;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public List<TripHighlightResponse> list(UserPrincipal caller) {
        boolean staff = WRITERS.contains(caller.role());
        Map<UUID, String> names = new HashMap<>();
        return highlights.findTop800ByOrderByCreatedAtDesc().stream()
                .filter(row -> staff || row.isPublished())
                .map(row -> toResponse(row, names))
                .toList();
    }

    @Transactional
    public TripHighlightResponse create(TripHighlightWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        Trip trip = requireTrip(request.tripId());
        List<TripHighlight> existing = highlights.findByTripIdOrderBySortOrderAscCreatedAtAsc(trip.getId());
        String label = cleanLabel(request.label());
        Kind kind = request.kind();
        boolean published = request.published() == null || request.published();
        boolean onCard = kind == Kind.CHIP && Boolean.TRUE.equals(request.onCard());
        assertRoom(existing, null, label, kind, onCard, published);
        int sort = request.sortOrder() != null ? request.sortOrder() : nextSort(existing, kind);
        TripHighlight row = new TripHighlight(trip.getId(), label, kind, sort, onCard, published);
        row.setCreatedBy(caller.id());
        TripHighlight saved = highlights.save(row);
        auditService.record("TRIP_HIGHLIGHT", saved.getId(), AuditAction.CREATE, "label", null, saved.getLabel());
        return toResponse(saved, new HashMap<>());
    }

    @Transactional
    public TripHighlightResponse update(UUID id, TripHighlightWriteRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        TripHighlight row = highlights.findById(id).orElseThrow(() -> new NotFoundException("Highlight not found: " + id));
        if (!row.getTripId().equals(request.tripId())) {
            throw new BadRequestException("A highlight stays on the trek it was written for");
        }
        List<TripHighlight> existing = highlights.findByTripIdOrderBySortOrderAscCreatedAtAsc(row.getTripId());
        String label = cleanLabel(request.label());
        Kind kind = request.kind();
        boolean published = request.published() == null ? row.isPublished() : request.published();
        boolean onCard = kind == Kind.CHIP && (request.onCard() == null ? row.isOnCard() : request.onCard());
        assertRoom(existing, row.getId(), label, kind, onCard, published);
        row.setLabel(label);
        row.setKind(kind);
        row.setPublished(published);
        row.setOnCard(onCard);
        if (request.sortOrder() != null) {
            row.setSortOrder(request.sortOrder());
        }
        highlights.save(row);
        auditService.record("TRIP_HIGHLIGHT", row.getId(), AuditAction.UPDATE, "label", null, row.getLabel());
        return toResponse(row, new HashMap<>());
    }

    @Transactional
    public void delete(UUID id, UserPrincipal caller) {
        requireWriter(caller.role());
        TripHighlight row = highlights.findById(id).orElseThrow(() -> new NotFoundException("Highlight not found: " + id));
        highlights.delete(row);
        auditService.record("TRIP_HIGHLIGHT", id, AuditAction.DELETE, "label", row.getLabel(), null);
    }

    @Transactional
    public TripHighlightCopyResponse copy(TripHighlightCopyRequest request, UserPrincipal caller) {
        requireWriter(caller.role());
        if (request.fromTripId().equals(request.toTripId())) {
            throw new BadRequestException("Choose a different trek to copy from");
        }
        requireTrip(request.fromTripId());
        requireTrip(request.toTripId());
        List<TripHighlight> target = highlights.findByTripIdOrderBySortOrderAscCreatedAtAsc(request.toTripId());
        Set<String> labels = target.stream()
                .map(row -> row.getLabel().toLowerCase(Locale.ROOT))
                .collect(java.util.stream.Collectors.toSet());
        int copied = 0;
        int skipped = 0;
        for (TripHighlight source : highlights.findByTripIdOrderBySortOrderAscCreatedAtAsc(request.fromTripId())) {
            if (!source.isPublished()) {
                skipped++;
                continue;
            }
            if (!labels.add(source.getLabel().toLowerCase(Locale.ROOT))) {
                skipped++;
                continue;
            }
            boolean summaryTaken = target.stream().anyMatch(row -> row.getKind() == Kind.SUMMARY);
            if (source.getKind() == Kind.SUMMARY && summaryTaken) {
                skipped++;
                continue;
            }
            long chips = target.stream().filter(row -> row.getKind() == Kind.CHIP).count();
            if (source.getKind() == Kind.CHIP && chips >= MAX_CHIPS) {
                skipped++;
                continue;
            }
            long onCard = target.stream().filter(row -> row.getKind() == Kind.CHIP && row.isOnCard() && row.isPublished()).count();
            boolean show = source.getKind() == Kind.CHIP && source.isOnCard() && onCard < MAX_ON_CARD;
            TripHighlight copy = new TripHighlight(
                    request.toTripId(), source.getLabel(), source.getKind(), source.getSortOrder(), show, true);
            copy.setCreatedBy(caller.id());
            TripHighlight saved = highlights.save(copy);
            target.add(saved);
            copied++;
        }
        return new TripHighlightCopyResponse(copied, skipped);
    }

    private void assertRoom(List<TripHighlight> existing, UUID self, String label, Kind kind, boolean onCard, boolean published) {
        boolean duplicate = existing.stream()
                .filter(row -> self == null || !row.getId().equals(self))
                .anyMatch(row -> row.getLabel().equalsIgnoreCase(label));
        if (duplicate) {
            throw new BadRequestException("This trek already has that line");
        }
        if (kind == Kind.SUMMARY) {
            boolean taken = existing.stream()
                    .anyMatch(row -> row.getKind() == Kind.SUMMARY && (self == null || !row.getId().equals(self)));
            if (taken) {
                throw new BadRequestException("This trek already has a selling line. Edit that one.");
            }
            return;
        }
        long chips = existing.stream()
                .filter(row -> row.getKind() == Kind.CHIP && (self == null || !row.getId().equals(self)))
                .count();
        if (chips >= MAX_CHIPS) {
            throw new BadRequestException("A trek holds at most 8 selling points");
        }
        if (onCard && published) {
            long shown = existing.stream()
                    .filter(row -> row.getKind() == Kind.CHIP && row.isOnCard() && row.isPublished())
                    .filter(row -> self == null || !row.getId().equals(self))
                    .count();
            if (shown >= MAX_ON_CARD) {
                throw new BadRequestException("Three points already show on the trek card. Take one off the card first.");
            }
        }
    }

    private static int nextSort(List<TripHighlight> existing, Kind kind) {
        return existing.stream()
                .filter(row -> row.getKind() == kind)
                .mapToInt(TripHighlight::getSortOrder)
                .max()
                .orElse(0) + 1;
    }

    private TripHighlightResponse toResponse(TripHighlight row, Map<UUID, String> names) {
        String tripName = names.computeIfAbsent(row.getTripId(),
                id -> trips.findById(id).map(Trip::getName).orElse(null));
        return new TripHighlightResponse(row.getId(), row.getTripId(), tripName, row.getLabel(), row.getKind(),
                row.getSortOrder(), row.isOnCard(), row.isPublished(), row.getCreatedAt());
    }

    private Trip requireTrip(UUID id) {
        return trips.findById(id).orElseThrow(() -> new NotFoundException("Trek not found: " + id));
    }

    private static String cleanLabel(String raw) {
        String text = XssSanitizer.text(raw == null ? "" : raw.trim());
        if (text == null || text.isBlank()) {
            throw new BadRequestException("Highlight text is required");
        }
        if (text.length() > 160) {
            throw new BadRequestException("Keep a highlight to 160 characters");
        }
        return text;
    }

    private static void requireWriter(Role role) {
        if (!WRITERS.contains(role)) {
            throw new ForbiddenException("This role (" + role + ") cannot edit trek highlights");
        }
    }
}
