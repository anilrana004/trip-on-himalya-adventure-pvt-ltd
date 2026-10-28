package com.securetravels.crm.marketing;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.WebhookSignatureException;
import com.securetravels.crm.common.util.PhoneUtils;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadService;
import com.securetravels.crm.lead.dto.LeadCreateRequest;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.user.User;
import com.securetravels.crm.webhook.RoundRobinService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Ingest Meta Lead Ads webhooks (ADR 0008). Signature-verified, idempotent on
 * Meta lead id, soft-dedupes on Indian mobile. Does not log field payloads.
 */
@Service
public class MetaLeadgenService {

    private static final Logger log = LoggerFactory.getLogger(MetaLeadgenService.class);

    private final ObjectMapper objectMapper;
    private final AppProperties props;
    private final MetaGraphClient graph;
    private final MetaLeadgenEventRepository events;
    private final LeadService leadService;
    private final RoundRobinService roundRobin;
    private final TripRepository trips;
    private final MetaAccessGuard access;

    public MetaLeadgenService(ObjectMapper objectMapper, AppProperties props, MetaGraphClient graph,
                              MetaLeadgenEventRepository events, LeadService leadService,
                              RoundRobinService roundRobin, TripRepository trips, MetaAccessGuard access) {
        this.objectMapper = objectMapper;
        this.props = props;
        this.graph = graph;
        this.events = events;
        this.leadService = leadService;
        this.roundRobin = roundRobin;
        this.trips = trips;
        this.access = access;
    }

    public String verifySubscription(String mode, String verifyToken, String challenge) {
        String expected = props.getMeta().getWebhookVerifyToken();
        if (expected == null || expected.isBlank()) {
            throw new WebhookSignatureException("META_WEBHOOK_VERIFY_TOKEN is not configured");
        }
        if (!"subscribe".equals(mode)
                || !constantTimeEquals(expected, verifyToken)
                || challenge == null
                || challenge.isBlank()) {
            throw new WebhookSignatureException("Meta webhook verification failed");
        }
        return challenge;
    }

    @Transactional
    public void ingest(byte[] raw, String signatureHeader) {
        if (!MetaHubSignature.matches(signatureHeader, props.getMeta().getAppSecret(), raw)) {
            throw new WebhookSignatureException("Missing or invalid " + MetaHubSignature.HEADER);
        }
        JsonNode root;
        try {
            root = objectMapper.readTree(raw);
        } catch (Exception ex) {
            throw new WebhookSignatureException("Meta webhook body is not valid JSON");
        }

        // Acknowledge unrecognized objects without error so Meta does not retry forever.
        if (!"page".equals(root.path("object").asText())) {
            log.info("[meta-leadgen] ignored non-page webhook object={}", root.path("object").asText());
            return;
        }

        for (JsonNode entry : root.path("entry")) {
            for (JsonNode change : entry.path("changes")) {
                if (!"leadgen".equals(change.path("field").asText())) {
                    continue;
                }
                JsonNode value = change.path("value");
                String leadgenId = text(value, "leadgen_id");
                if (leadgenId == null || !leadgenId.matches("[0-9A-Za-z_-]{1,64}")) {
                    continue;
                }
                processLeadgen(
                        leadgenId,
                        text(value, "page_id"),
                        text(value, "form_id"),
                        text(value, "ad_id"),
                        text(value, "adgroup_id"),
                        text(value, "campaign_id"));
            }
        }
    }

    private void processLeadgen(String leadgenId, String pageId, String formId,
                                String adId, String adgroupId, String campaignId) {
        var existing = events.findByMetaLeadId(leadgenId);
        if (existing.isPresent()) {
            MetaLeadgenEvent.Status st = existing.get().getStatus();
            if (st == MetaLeadgenEvent.Status.PROCESSED || st == MetaLeadgenEvent.Status.DUPLICATE) {
                log.info("[meta-leadgen] skip already handled metaLeadId={}", leadgenId);
                return;
            }
            if (st == MetaLeadgenEvent.Status.FAILED) {
                // Allow a later delivery / manual retry to re-attempt.
                tryProcess(existing.get());
                return;
            }
            // RECEIVED stuck — continue processing the same row.
            tryProcess(existing.get());
            return;
        }

        MetaLeadgenEvent event = new MetaLeadgenEvent(leadgenId, pageId, formId, adId, adgroupId, campaignId);
        try {
            events.saveAndFlush(event);
        } catch (DataIntegrityViolationException ex) {
            log.info("[meta-leadgen] concurrent insert for metaLeadId={}", leadgenId);
            return;
        }
        tryProcess(event);
    }

    private void tryProcess(MetaLeadgenEvent event) {
        try {
            if (!props.getMeta().configured()) {
                event.markFailed("META_ACCESS_TOKEN is not configured");
                events.save(event);
                return;
            }
            access.requireLeads();

            JsonNode leadJson = graph.get(
                    "leadgen.get",
                    event.getMetaLeadId(),
                    event.getMetaLeadId(),
                    Map.of("fields", "id,created_time,field_data,platform"));

            Map<String, String> fields = fieldMap(leadJson.path("field_data"));
            String name = firstPresent(fields,
                    "full_name", "full name", "name", "first_name", "firstname");
            if (name == null) {
                String first = firstPresent(fields, "first_name", "firstname");
                String last = firstPresent(fields, "last_name", "lastname");
                if (first != null || last != null) {
                    name = ((first == null ? "" : first) + " " + (last == null ? "" : last)).trim();
                }
            }
            if (name == null || name.isBlank()) {
                name = "Meta Lead " + event.getMetaLeadId();
            }

            String phoneRaw = firstPresent(fields,
                    "phone_number", "phone", "mobile_number", "mobile", "contact_number");
            String digits = PhoneUtils.normalize(phoneRaw);
            if (digits == null) {
                event.markFailed("Lead has no valid Indian mobile number");
                events.save(event);
                log.warn("[meta-leadgen] rejected metaLeadId={} — invalid/missing phone", event.getMetaLeadId());
                return;
            }

            String email = firstPresent(fields, "email", "email_address");
            Lead.Source source = resolveSource(leadJson.path("platform").asText(null), fields);
            String destination = firstPresent(fields,
                    "destination", "trek", "trek_name", "trip", "trip_name", "package",
                    "which_trek", "interested_trek", "tour_name", "which_tour");
            UUID tripId = resolveTripId(destination);
            if (destination == null && tripId != null) {
                destination = trips.findById(tripId).map(Trip::getName).orElse(null);
            }

            String remarks = buildRemarks(event, fields);

            LeadCreateRequest request = new LeadCreateRequest(
                    name,
                    digits,
                    digits,
                    email,
                    source,
                    destination,
                    tripId,
                    null,
                    1,
                    null,
                    null,
                    null,
                    null,
                    remarks,
                    true,
                    "meta lead ads form submission");

            User owner = roundRobin.assignForEnquiry(tripId, destination, event.getCampaignId());
            LeadService.LeadIngestResult result =
                    leadService.createFromMeta(request, owner.getId(), event.getMetaLeadId());

            if (result.duplicate()) {
                event.markDuplicate(result.lead().id());
            } else {
                event.markProcessed(result.lead().id());
            }
            events.save(event);
            log.info("[meta-leadgen] {} metaLeadId={} crmLeadId={}",
                    result.duplicate() ? "duplicate" : "created",
                    event.getMetaLeadId(),
                    result.lead().id());
        } catch (Exception ex) {
            event.markFailed(sanitizeFailure(ex.getMessage()));
            events.save(event);
            log.warn("[meta-leadgen] failed metaLeadId={}: {}", event.getMetaLeadId(), ex.getClass().getSimpleName());
        }
    }

    /** Never persist token-shaped fragments from Graph/transport errors. */
    static String sanitizeFailure(String message) {
        if (message == null || message.isBlank()) {
            return "leadgen processing failed";
        }
        String cleaned = message.replaceAll("(?i)access_token=[^&\\s]+", "access_token=***");
        cleaned = cleaned.replaceAll("(?i)EAA[A-Za-z0-9]+", "***");
        return cleaned.length() > 1000 ? cleaned.substring(0, 1000) : cleaned;
    }

    private static boolean constantTimeEquals(String expected, String provided) {
        if (provided == null) {
            return false;
        }
        byte[] a = expected.getBytes(StandardCharsets.UTF_8);
        byte[] b = provided.getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(a, b);
    }

    private static Lead.Source resolveSource(String platform, Map<String, String> fields) {
        String p = platform == null ? "" : platform.toLowerCase(Locale.ROOT);
        if (p.contains("ig") || p.contains("instagram")) {
            return Lead.Source.INSTAGRAM;
        }
        String channel = firstPresent(fields, "platform", "channel");
        if (channel != null && channel.toLowerCase(Locale.ROOT).contains("instagram")) {
            return Lead.Source.INSTAGRAM;
        }
        return Lead.Source.FACEBOOK_ADS;
    }

    private static String buildRemarks(MetaLeadgenEvent event, Map<String, String> fields) {
        List<String> parts = new ArrayList<>();
        parts.add("Source: Meta Lead Ads");
        if (event.getFormId() != null) parts.add("form_id=" + event.getFormId());
        if (event.getCampaignId() != null) parts.add("campaign_id=" + event.getCampaignId());
        if (event.getAdId() != null) parts.add("ad_id=" + event.getAdId());
        if (event.getPageId() != null) parts.add("page_id=" + event.getPageId());
        // Include non-PII custom questions only (skip phone/email/name keys).
        for (Map.Entry<String, String> e : fields.entrySet()) {
            String key = e.getKey().toLowerCase(Locale.ROOT);
            if (key.contains("phone") || key.contains("mobile") || key.contains("email")
                    || key.contains("name") || key.contains("password")) {
                continue;
            }
            if (e.getValue() != null && !e.getValue().isBlank()) {
                parts.add(e.getKey() + "=" + e.getValue());
            }
        }
        String joined = String.join("; ", parts);
        return joined.length() > 5000 ? joined.substring(0, 5000) : joined;
    }

    private static Map<String, String> fieldMap(JsonNode fieldData) {
        Map<String, String> map = new HashMap<>();
        if (fieldData == null || !fieldData.isArray()) {
            return map;
        }
        for (JsonNode node : fieldData) {
            String name = text(node, "name");
            if (name == null) continue;
            JsonNode values = node.path("values");
            if (values.isArray() && values.size() > 0) {
                map.put(name.toLowerCase(Locale.ROOT), values.get(0).asText());
            }
        }
        return map;
    }

    private UUID resolveTripId(String destination) {
        if (destination == null || destination.isBlank()) {
            return null;
        }
        List<Trip> matches = trips.findActiveNameMatches(destination.trim(), PageRequest.of(0, 1));
        return matches.isEmpty() ? null : matches.get(0).getId();
    }

    private static String firstPresent(Map<String, String> fields, String... keys) {
        for (String key : keys) {
            String v = fields.get(key.toLowerCase(Locale.ROOT));
            if (v != null && !v.isBlank()) {
                return v.trim();
            }
        }
        return null;
    }

    private static String text(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) {
            return null;
        }
        String v = node.get(field).asText();
        return v == null || v.isBlank() ? null : v;
    }
}
