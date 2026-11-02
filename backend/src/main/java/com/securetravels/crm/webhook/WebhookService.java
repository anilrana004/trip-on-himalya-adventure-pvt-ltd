package com.securetravels.crm.webhook;

import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.WebhookSignatureException;
import com.securetravels.crm.common.util.PhoneUtils;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.lead.LeadService;
import com.securetravels.crm.lead.dto.LeadCreateRequest;
import com.securetravels.crm.lead.dto.LeadResponse;
import com.securetravels.crm.trip.Trip;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.user.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Public channel intake (website form + sibling storefront BFF). Verifies
 * HMAC-SHA256, validates the payload, soft-dedupes by phone then email,
 * resolves optional trip slug for sticky round-robin, then runs the standard
 * lead pipeline. Every call is recorded in webhook_logs.
 */
@Service
public class WebhookService {

    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final String LOG_WEBSITE = "WEBSITE";
    private static final String LOG_STOREFRONT = "STOREFRONT";
    private static final int MAX_STORED_PAYLOAD = 10_000;
    private static final int MAX_NAME = 200;
    private static final int MAX_PHONE = 30;
    private static final int MAX_EMAIL = 255;
    private static final int MAX_DESTINATION = 120;
    private static final int MAX_TRIP_SLUG = 160;
    private static final int MAX_REMARKS = 5000;
    private static final int MAX_CONSENT_SCOPE = 200;
    private static final int MIN_PERSONS = 1;
    private static final int MAX_PERSONS = 50;
    private static final int MAX_BUDGET_INTEGER_DIGITS = 12;
    private static final int MAX_BUDGET_FRACTION_DIGITS = 2;

    private final ObjectMapper objectMapper;
    private final AppProperties props;
    private final RoundRobinService roundRobin;
    private final LeadService leadService;
    private final LeadRepository leads;
    private final TripRepository trips;
    private final WebhookLogRepository webhookLogs;

    public WebhookService(ObjectMapper objectMapper, AppProperties props, RoundRobinService roundRobin,
                          LeadService leadService, LeadRepository leads, TripRepository trips,
                          WebhookLogRepository webhookLogs) {
        this.objectMapper = objectMapper;
        this.props = props;
        this.roundRobin = roundRobin;
        this.leadService = leadService;
        this.leads = leads;
        this.trips = trips;
        this.webhookLogs = webhookLogs;
    }

    @Transactional
    public WebhookLeadResponse ingest(byte[] raw, String payload, String signature) {
        if (!WebhookSignature.matches(signature, props.getWebhook().getSecret(), raw)) {
            throw new WebhookSignatureException("Missing or invalid " + WebhookSignature.HEADER);
        }

        WebhookLeadRequest req;
        try {
            req = objectMapper.readValue(payload, WebhookLeadRequest.class);
        } catch (JsonProcessingException ex) {
            throw new BadRequestException("Request body is malformed JSON");
        }
        validate(req);

        Lead.Source channel = parseSource(req.source());
        String logSource = channel == Lead.Source.STOREFRONT ? LOG_STOREFRONT : LOG_WEBSITE;

        Lead duplicate = findDuplicate(req);
        if (duplicate != null) {
            log(logSource, payload, duplicate.getId(), WebhookLog.Status.duplicate, null);
            return new WebhookLeadResponse(true, true, duplicate.getId(), duplicate.getOwnerId(), null,
                    "Duplicate lead; existing lead returned");
        }

        UUID tripId = resolveTripId(req.tripSlug());
        String destination = blankToNull(req.destination());
        if (destination == null && tripId != null) {
            destination = trips.findById(tripId).map(Trip::getName).orElse(null);
        }

        LeadCreateRequest createReq = toCreateRequest(req, channel, tripId, destination);
        User owner = roundRobin.assignForEnquiry(createReq.tripId(), createReq.destination(), null);
        LeadResponse created = leadService.createAutomated(createReq, owner.getId());

        log(logSource, payload, created.id(), WebhookLog.Status.success, null);
        return new WebhookLeadResponse(true, false, created.id(), owner.getId(), owner.getFullName(),
                "Lead created and assigned to " + owner.getFullName() + ". 5-minute call task scheduled.");
    }

    /**
     * Latest public-form posts for managers. Payload text stays in the table
     * and is not copied onto the response.
     */
    @Transactional(readOnly = true)
    public List<WebhookAttemptResponse> recentAttempts() {
        return webhookLogs.latestAttempts(PageRequest.of(0, 40)).stream()
                .map(row -> new WebhookAttemptResponse(
                        row.getId(),
                        row.getSource(),
                        row.getStatus(),
                        safeError(row.getErrorMessage()),
                        row.getLeadId(),
                        row.getCreatedAt()))
                .toList();
    }

    static String safeError(String message) {
        if (message == null || message.isBlank()) {
            return null;
        }
        String cleaned = message.replaceAll("(?i)access_token=[^&\\s]+", "access_token=***");
        cleaned = cleaned.replaceAll("\\b[6-9]\\d{9}\\b", "***");
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }

    @Transactional
    public void logFailure(String payload, String errorMessage) {
        log(LOG_WEBSITE, payload, null, WebhookLog.Status.failed,
                errorMessage == null ? null : errorMessage.substring(0, Math.min(1000, errorMessage.length())));
    }

    private void log(String source, String payload, UUID leadId, WebhookLog.Status status, String errorMessage) {
        String bounded = payload == null ? "" : payload.substring(0, Math.min(MAX_STORED_PAYLOAD, payload.length()));
        webhookLogs.save(new WebhookLog(source, bounded, leadId, status, errorMessage));
    }

    private Lead findDuplicate(WebhookLeadRequest req) {
        Lead byPhone = leads.findFirstActiveDuplicate(PhoneUtils.normalize(req.mobileNumber())).orElse(null);
        if (byPhone != null) {
            return byPhone;
        }
        if (!isBlank(req.email())) {
            return leads.findFirstActiveDuplicateByEmail(req.email().trim()).orElse(null);
        }
        return null;
    }

    private UUID resolveTripId(String tripSlug) {
        if (isBlank(tripSlug)) {
            return null;
        }
        String slug = tripSlug.trim().toLowerCase(Locale.ROOT);
        return trips.findBySlug(slug)
                .or(() -> trips.findBySlug(tripSlug.trim()))
                .filter(Trip::isActive)
                .map(Trip::getId)
                .orElse(null);
    }

    private void validate(WebhookLeadRequest req) {
        if (isBlank(req.customerName())) {
            throw new BadRequestException("customerName is required");
        }
        if (req.customerName().length() > MAX_NAME) {
            throw new BadRequestException("customerName must be at most " + MAX_NAME + " characters");
        }
        if (isBlank(req.mobileNumber()) || !PhoneUtils.isValidMobile(req.mobileNumber())) {
            throw new BadRequestException("mobileNumber is required and must be a valid Indian mobile number");
        }
        if (req.mobileNumber().length() > MAX_PHONE) {
            throw new BadRequestException("mobileNumber must be at most " + MAX_PHONE + " characters");
        }
        if (!isBlank(req.whatsappNumber())) {
            if (!PhoneUtils.isValidMobile(req.whatsappNumber())) {
                throw new BadRequestException("whatsappNumber must be a valid Indian mobile number");
            }
            if (req.whatsappNumber().length() > MAX_PHONE) {
                throw new BadRequestException("whatsappNumber must be at most " + MAX_PHONE + " characters");
            }
        }
        if (!isBlank(req.email())) {
            if (!EMAIL.matcher(req.email()).matches()) {
                throw new BadRequestException("email must be valid");
            }
            if (req.email().length() > MAX_EMAIL) {
                throw new BadRequestException("email must be at most " + MAX_EMAIL + " characters");
            }
        }
        if (req.destination() != null && req.destination().length() > MAX_DESTINATION) {
            throw new BadRequestException("destination must be at most " + MAX_DESTINATION + " characters");
        }
        if (req.tripSlug() != null && req.tripSlug().length() > MAX_TRIP_SLUG) {
            throw new BadRequestException("tripSlug must be at most " + MAX_TRIP_SLUG + " characters");
        }
        if (req.numPersons() != null && (req.numPersons() < MIN_PERSONS || req.numPersons() > MAX_PERSONS)) {
            throw new BadRequestException("numPersons must be between " + MIN_PERSONS + " and " + MAX_PERSONS);
        }
        if (req.budget() != null && !isValidBudget(req.budget())) {
            throw new BadRequestException("budget cannot be negative and must have at most "
                    + MAX_BUDGET_INTEGER_DIGITS + " integer and " + MAX_BUDGET_FRACTION_DIGITS
                    + " fractional digits");
        }
        if (req.consentScope() != null && req.consentScope().length() > MAX_CONSENT_SCOPE) {
            throw new BadRequestException("consentScope must be at most " + MAX_CONSENT_SCOPE + " characters");
        }
        if (req.remarks() != null && req.remarks().length() > MAX_REMARKS) {
            throw new BadRequestException("remarks must be at most " + MAX_REMARKS + " characters");
        }
        if (!req.consentGiven()) {
            throw new BadRequestException("Explicit consent (consent_given=true) is required to create a lead");
        }
    }

    private boolean isValidBudget(BigDecimal budget) {
        if (budget.signum() < 0) {
            return false;
        }
        if (budget.scale() > MAX_BUDGET_FRACTION_DIGITS) {
            return false;
        }
        return budget.precision() - budget.scale() <= MAX_BUDGET_INTEGER_DIGITS;
    }

    private LeadCreateRequest toCreateRequest(WebhookLeadRequest req, Lead.Source channel,
                                              UUID tripId, String destination) {
        return new LeadCreateRequest(
                req.customerName().trim(),
                req.mobileNumber().trim(),
                blankToNull(req.whatsappNumber()),
                blankToNull(req.email()),
                channel,
                destination,
                tripId,
                null,
                req.numPersons(),
                req.budget(),
                null,
                null,
                null,
                blankToNull(req.remarks()),
                true,
                isBlank(req.consentScope())
                        ? "contact for travel enquiry and follow-up"
                        : req.consentScope().trim());
    }

    private Lead.Source parseSource(String raw) {
        if (isBlank(raw)) {
            return Lead.Source.WEBSITE;
        }
        try {
            return Lead.Source.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return Lead.Source.WEBSITE;
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private String blankToNull(String value) {
        return isBlank(value) ? null : value.trim();
    }
}
