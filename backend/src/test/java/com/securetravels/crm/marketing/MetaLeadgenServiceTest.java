package com.securetravels.crm.marketing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.WebhookSignatureException;
import com.securetravels.crm.common.security.HmacSigner;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadService;
import com.securetravels.crm.lead.dto.LeadResponse;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.user.User;
import com.securetravels.crm.webhook.RoundRobinService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MetaLeadgenServiceTest {

    private static final String SECRET = "meta-app-secret-for-tests";

    private final ObjectMapper mapper = new ObjectMapper();
    private MetaGraphClient graph;
    private MetaLeadgenEventRepository events;
    private LeadService leadService;
    private RoundRobinService roundRobin;
    private TripRepository trips;
    private AppProperties props;
    private MetaAccessGuard access;
    private MetaLeadgenService service;

    @BeforeEach
    void setUp() {
        graph = mock(MetaGraphClient.class);
        events = mock(MetaLeadgenEventRepository.class);
        leadService = mock(LeadService.class);
        roundRobin = mock(RoundRobinService.class);
        trips = mock(TripRepository.class);
        access = mock(MetaAccessGuard.class);
        props = new AppProperties();
        props.getMeta().setAppSecret(SECRET);
        props.getMeta().setAccessToken("token");
        props.getMeta().setWebhookVerifyToken("verify-me");
        service = new MetaLeadgenService(mapper, props, graph, events, leadService, roundRobin, trips, access);

        when(events.findByMetaLeadId(anyString())).thenReturn(Optional.empty());
        when(events.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(events.saveAndFlush(any())).thenAnswer(inv -> inv.getArgument(0));
        when(trips.findActiveNameMatches(anyString(), any())).thenReturn(java.util.List.of());
        User owner = mock(User.class);
        when(owner.getId()).thenReturn(UUID.randomUUID());
        when(roundRobin.assignForEnquiry(any(), any(), any())).thenReturn(owner);
        when(roundRobin.pickNextSalesUser()).thenReturn(owner);
    }

    @Test
    void verifySubscriptionReturnsChallenge() {
        assertThat(service.verifySubscription("subscribe", "verify-me", "12345")).isEqualTo("12345");
    }

    @Test
    void verifySubscriptionRejectsBadToken() {
        assertThatThrownBy(() -> service.verifySubscription("subscribe", "wrong", "12345"))
                .isInstanceOf(WebhookSignatureException.class);
    }

    @Test
    void invalidSignatureRejected() {
        byte[] body = "{\"object\":\"page\",\"entry\":[]}".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> service.ingest(body, "sha256=deadbeef"))
                .isInstanceOf(WebhookSignatureException.class);
    }

    @Test
    void leadgenCreatesCrmLead() throws Exception {
        String leadgenId = "lead_100";
        ObjectNode webhook = mapper.createObjectNode();
        webhook.put("object", "page");
        ObjectNode entry = webhook.putArray("entry").addObject();
        ObjectNode change = entry.putArray("changes").addObject();
        change.put("field", "leadgen");
        ObjectNode value = change.putObject("value");
        value.put("leadgen_id", leadgenId);
        value.put("page_id", "page1");
        value.put("form_id", "form1");
        value.put("campaign_id", "camp1");
        value.put("ad_id", "ad1");

        byte[] raw = mapper.writeValueAsBytes(webhook);
        String sig = HmacSigner.sign(SECRET, raw);

        ObjectNode leadJson = mapper.createObjectNode();
        leadJson.put("id", leadgenId);
        leadJson.put("platform", "fb");
        ArrayNode fieldData = leadJson.putArray("field_data");
        fieldData.addObject().put("name", "full_name").putArray("values").add("Asha Trekker");
        fieldData.addObject().put("name", "phone_number").putArray("values").add("9876543210");
        fieldData.addObject().put("name", "email").putArray("values").add("asha@example.com");
        when(graph.get(eq("leadgen.get"), eq(leadgenId), eq(leadgenId), anyMap())).thenReturn(leadJson);

        UUID crmId = UUID.randomUUID();
        LeadResponse response = new LeadResponse(
                crmId, "Asha Trekker", "9876543210", "9876543210", "asha@example.com",
                Lead.Source.FACEBOOK_ADS, null, null, null, 1, null, null, null, null, null,
                Lead.Status.NEW, Lead.Heat.COLD, null, null, true, null, Instant.now(),
                null, null, null, Instant.now(), Instant.now());
        when(leadService.createFromMeta(any(), any(), eq(leadgenId)))
                .thenReturn(new LeadService.LeadIngestResult(response, false));

        service.ingest(raw, sig);

        verify(leadService).createFromMeta(any(), any(), eq(leadgenId));
        verify(events, org.mockito.Mockito.atLeastOnce()).save(any());
    }

    @Test
    void alreadyProcessedIsSkipped() throws Exception {
        MetaLeadgenEvent existing = new MetaLeadgenEvent("lead_dup", null, null, null, null, null);
        existing.markProcessed(UUID.randomUUID());
        when(events.findByMetaLeadId("lead_dup")).thenReturn(Optional.of(existing));

        ObjectNode webhook = mapper.createObjectNode();
        webhook.put("object", "page");
        ObjectNode change = webhook.putArray("entry").addObject().putArray("changes").addObject();
        change.put("field", "leadgen");
        change.putObject("value").put("leadgen_id", "lead_dup");
        byte[] raw = mapper.writeValueAsBytes(webhook);

        service.ingest(raw, HmacSigner.sign(SECRET, raw));

        verify(graph, never()).get(anyString(), any(), anyString(), anyMap());
        verify(leadService, never()).createFromMeta(any(), any(), anyString());
    }

    @Test
    void nonPageObjectIsAcknowledgedWithoutGraph() throws Exception {
        byte[] raw = "{\"object\":\"user\",\"entry\":[]}".getBytes(StandardCharsets.UTF_8);
        service.ingest(raw, HmacSigner.sign(SECRET, raw));
        verify(graph, never()).get(anyString(), any(), anyString(), anyMap());
        verify(leadService, never()).createFromMeta(any(), any(), anyString());
    }

    @Test
    void nonLeadgenFieldIsIgnored() throws Exception {
        ObjectNode webhook = mapper.createObjectNode();
        webhook.put("object", "page");
        ObjectNode change = webhook.putArray("entry").addObject().putArray("changes").addObject();
        change.put("field", "feed");
        change.putObject("value").put("leadgen_id", "should_ignore");
        byte[] raw = mapper.writeValueAsBytes(webhook);

        service.ingest(raw, HmacSigner.sign(SECRET, raw));

        verify(graph, never()).get(anyString(), any(), anyString(), anyMap());
        verify(events, never()).saveAndFlush(any());
    }

    @Test
    void missingLeadPermissionDoesNotFetchTheLead() throws Exception {
        org.mockito.Mockito.doThrow(new ForbiddenException(
                        "Lead retrieval is disabled. Grant leads_retrieval."))
                .when(access).requireLeads();

        ObjectNode webhook = mapper.createObjectNode();
        webhook.put("object", "page");
        ObjectNode change = webhook.putArray("entry").addObject().putArray("changes").addObject();
        change.put("field", "leadgen");
        change.putObject("value").put("leadgen_id", "lead_blocked");
        byte[] raw = mapper.writeValueAsBytes(webhook);

        service.ingest(raw, HmacSigner.sign(SECRET, raw));

        verify(graph, never()).get(eq("leadgen.get"), any(), anyString(), anyMap());
        var saved = org.mockito.ArgumentCaptor.forClass(MetaLeadgenEvent.class);
        verify(events, org.mockito.Mockito.atLeastOnce()).save(saved.capture());
        assertThat(saved.getValue().getStatus()).isEqualTo(MetaLeadgenEvent.Status.FAILED);
        assertThat(saved.getValue().getErrorMessage()).contains("leads_retrieval").doesNotContain("EAA");
    }

    @Test
    void sanitizeFailureStripsAccessTokenFragments() {
        assertThat(MetaLeadgenService.sanitizeFailure("bad access_token=EAABleak&x=1"))
                .doesNotContain("EAABleak")
                .contains("access_token=***");
        assertThat(MetaLeadgenService.sanitizeFailure("EAABxxxxxxTokenShape")).doesNotContain("EAABxxxxxx");
        assertThat(MetaLeadgenService.sanitizeFailure(null)).isEqualTo("leadgen processing failed");
    }

    @Test
    void verifySubscriptionRejectsBlankChallenge() {
        assertThatThrownBy(() -> service.verifySubscription("subscribe", "verify-me", "  "))
                .isInstanceOf(WebhookSignatureException.class);
    }
}
