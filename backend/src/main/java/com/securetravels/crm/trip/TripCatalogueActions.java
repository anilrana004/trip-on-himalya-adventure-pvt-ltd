package com.securetravels.crm.trip;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.trip.dto.TripBulkStatusRequest;
import com.securetravels.crm.trip.dto.TripBulkStatusResponse;
import com.securetravels.crm.trip.dto.TripCloneRequest;
import com.securetravels.crm.trip.dto.TripCloneResponse;
import com.securetravels.crm.trip.dto.TripCreateRequest;
import com.securetravels.crm.trip.dto.TripImportRequest;
import com.securetravels.crm.trip.dto.TripImportResponse;
import com.securetravels.crm.trip.faq.TripFaq;
import com.securetravels.crm.trip.faq.TripFaqRepository;
import com.securetravels.crm.trip.highlight.TripHighlight;
import com.securetravels.crm.trip.highlight.TripHighlightRepository;
import com.securetravels.crm.trip.tag.TripTag;
import com.securetravels.crm.trip.tag.TripTagRepository;
import com.securetravels.crm.trip.waypoint.TripWaypoint;
import com.securetravels.crm.trip.waypoint.TripWaypointRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/**
 * Catalogue operations that stay on the trek record: a draft copy of a package,
 * a status change for a selection, and a draft import. Leads, bookings, and
 * departures are not copied and are not created here.
 */
@Service
public class TripCatalogueActions {

    private static final int MAX_STATUS = 50;
    private static final int MAX_IMPORT = 40;

    private final TripRepository trips;
    private final TripService tripService;
    private final TripHighlightRepository highlights;
    private final TripFaqRepository faqs;
    private final TripTagRepository tags;
    private final TripWaypointRepository waypoints;
    private final AuditService auditService;

    public TripCatalogueActions(TripRepository trips, TripService tripService, TripHighlightRepository highlights,
                                TripFaqRepository faqs, TripTagRepository tags, TripWaypointRepository waypoints,
                                AuditService auditService) {
        this.trips = trips;
        this.tripService = tripService;
        this.highlights = highlights;
        this.faqs = faqs;
        this.tags = tags;
        this.waypoints = waypoints;
        this.auditService = auditService;
    }

    @Transactional
    public TripCloneResponse clone(UUID sourceId, TripCloneRequest request, UserPrincipal caller) {
        requireManager(caller.role());
        Trip source = trips.findById(sourceId).orElseThrow(() -> new NotFoundException("Trek not found: " + sourceId));
        String name = cleanName(request == null ? null : request.name(), source.getName());

        Trip copy = new Trip();
        copy.setName(name);
        copy.setSlug(tripService.unusedSlug(name));
        copy.setCategory(source.getCategory());
        copy.setBookingType(source.getBookingType());
        copy.setDifficulty(source.getDifficulty());
        copy.setBaseCost(source.getBaseCost());
        copy.setDurationDays(source.getDurationDays());
        copy.setItinerary(source.getItinerary());
        copy.setInclusions(source.getInclusions());
        copy.setExclusions(source.getExclusions());
        copy.setCoverImageUrl(source.getCoverImageUrl());
        copy.setMetaTitle(source.getMetaTitle());
        copy.setMetaDescription(source.getMetaDescription());
        copy.setContentBrief(source.getContentBrief());
        copy.setActive(false);
        Trip saved = trips.save(copy);
        auditService.record("TRIP", saved.getId(), AuditAction.CREATE, "cloned_from", null, source.getId().toString());

        int highlightCount = copyHighlights(source.getId(), saved.getId(), caller.id());
        int faqCount = copyFaqs(source.getId(), saved.getId(), caller.id());
        int tagCount = copyTags(source.getId(), saved.getId(), caller.id());
        copyWaypoints(source.getId(), saved.getId(), caller.id());
        return new TripCloneResponse(tripService.get(saved.getId()), highlightCount, faqCount, tagCount);
    }

    @Transactional
    public TripBulkStatusResponse setActive(TripBulkStatusRequest request, UserPrincipal caller) {
        requireManager(caller.role());
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(request.ids());
        if (ids.size() > MAX_STATUS) {
            throw new BadRequestException("Select at most 50 treks");
        }
        int updated = 0;
        int unchanged = 0;
        List<UUID> missing = new ArrayList<>();
        for (UUID id : ids) {
            Trip trip = trips.findById(id).orElse(null);
            if (trip == null) {
                missing.add(id);
                continue;
            }
            if (trip.isActive() == request.active()) {
                unchanged++;
                continue;
            }
            auditService.record("TRIP", trip.getId(), AuditAction.STATUS_CHANGE, "active",
                    String.valueOf(trip.isActive()), String.valueOf(request.active()));
            trip.setActive(request.active());
            updated++;
        }
        return new TripBulkStatusResponse(updated, unchanged, missing);
    }

    @Transactional
    public TripImportResponse importDrafts(TripImportRequest request, UserPrincipal caller) {
        requireManager(caller.role());
        if (request.trips().size() > MAX_IMPORT) {
            throw new BadRequestException("Import at most 40 treks at a time");
        }
        List<String> names = new ArrayList<>();
        for (TripCreateRequest row : request.trips()) {
            names.add(tripService.create(row, caller, false).name());
        }
        return new TripImportResponse(names.size(), names);
    }

    private int copyHighlights(UUID from, UUID to, UUID actor) {
        int count = 0;
        for (TripHighlight source : highlights.findByTripIdOrderBySortOrderAscCreatedAtAsc(from)) {
            TripHighlight copy = new TripHighlight(to, source.getLabel(), source.getKind(), source.getSortOrder(),
                    source.isOnCard(), source.isPublished());
            copy.setCreatedBy(actor);
            highlights.save(copy);
            count++;
        }
        return count;
    }

    private int copyFaqs(UUID from, UUID to, UUID actor) {
        int count = 0;
        for (TripFaq source : faqs.findByTripIdOrderByCreatedAtAsc(from)) {
            TripFaq copy = new TripFaq(to, source.getQuestion(), source.getAnswer(), source.isPublished());
            copy.setCreatedBy(actor);
            faqs.save(copy);
            count++;
        }
        return count;
    }

    private int copyTags(UUID from, UUID to, UUID actor) {
        int count = 0;
        for (TripTag source : tags.findByTripIdOrderByCreatedAtAsc(from)) {
            TripTag copy = new TripTag(to, source.getLabel(), source.getKind(), source.isOnCard());
            copy.setCreatedBy(actor);
            tags.save(copy);
            count++;
        }
        return count;
    }

    private void copyWaypoints(UUID from, UUID to, UUID actor) {
        for (TripWaypoint source : waypoints.findByTripIdOrderBySortOrderAscCreatedAtAsc(from)) {
            TripWaypoint copy = new TripWaypoint(to, source.getName(), source.getKind(), source.getLatitude(),
                    source.getLongitude(), source.getAltitudeM(), source.getDayNumber(), source.getSortOrder());
            copy.setCreatedBy(actor);
            waypoints.save(copy);
        }
    }

    private static String cleanName(String requested, String sourceName) {
        String raw = requested == null || requested.isBlank() ? "Copy of " + sourceName : requested.trim();
        String text = XssSanitizer.text(raw);
        if (text == null || text.isBlank()) {
            throw new BadRequestException("The copy needs a name");
        }
        return text.length() > 255 ? text.substring(0, 255) : text;
    }

    private static void requireManager(Role role) {
        if (role != Role.MANAGER && role != Role.ADMIN && role != Role.CEO) {
            throw new ForbiddenException("Only managers can clone or update the catalogue");
        }
    }
}
