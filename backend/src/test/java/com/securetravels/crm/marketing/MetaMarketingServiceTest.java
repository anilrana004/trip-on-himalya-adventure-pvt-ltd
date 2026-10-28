package com.securetravels.crm.marketing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.ServiceUnavailableException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MetaMarketingServiceTest {

    private final ObjectMapper mapper = new ObjectMapper();
    private MetaGraphClient graph;
    private MetaAdAccountRepository accounts;
    private MetaApiCallLogRepository callLogs;
    private AppProperties props;
    private MetaAccessGuard access;
    private MetaMarketingService service;

    @BeforeEach
    void setUp() {
        graph = mock(MetaGraphClient.class);
        accounts = mock(MetaAdAccountRepository.class);
        callLogs = mock(MetaApiCallLogRepository.class);
        access = mock(MetaAccessGuard.class);
        props = new AppProperties();
        props.getMeta().setAccessToken("token");
        props.getMeta().setAdAccountIds("act_111");
        service = new MetaMarketingService(graph, accounts, callLogs, props, access);
        when(accounts.findByMetaAccountId(anyString())).thenReturn(Optional.empty());
        when(accounts.save(any())).thenAnswer(inv -> inv.getArgument(0));
    }

    @Test
    void listAdAccountsFiltersToAllowlist() {
        ObjectNode a = mapper.createObjectNode().put("id", "act_111").put("name", "TOH").put("currency", "INR");
        ObjectNode b = mapper.createObjectNode().put("id", "act_999").put("name", "Other");
        ArrayNode data = mapper.createArrayNode().add(a).add(b);
        ObjectNode body = mapper.createObjectNode().set("data", data);

        when(graph.getAllPages(eq("adaccounts.list"), isNull(), eq("me/adaccounts"), anyMap(), anyInt(), any()))
                .thenAnswer(inv -> {
                    @SuppressWarnings("unchecked")
                    Function<com.fasterxml.jackson.databind.JsonNode, java.util.Iterator<com.fasterxml.jackson.databind.JsonNode>> extractor =
                            inv.getArgument(5);
                    java.util.List<com.fasterxml.jackson.databind.JsonNode> out = new java.util.ArrayList<>();
                    extractor.apply(body).forEachRemaining(out::add);
                    return out;
                });

        var list = service.listAdAccounts();
        assertThat(list).hasSize(1);
        assertThat(list.get(0).id()).isEqualTo("act_111");
        verify(accounts).save(any());
    }

    @Test
    void unauthorizedAccountIsForbidden() {
        assertThatThrownBy(() -> service.listCampaigns("act_999", null, 10))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void insightsRejectsPartialDateRange() {
        assertThatThrownBy(() -> service.insights("act_111", null, "2026-01-01", null, "campaign"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void usageSummaryReturnsSanitizedRows() {
        MetaApiCallLog row = new MetaApiCallLog(
                "c1", "campaigns.list", "act_111", "v22.0", 200, true, null);
        when(callLogs.countSince(any(Instant.class), eq(true))).thenReturn(3L);
        when(callLogs.countSince(any(Instant.class), eq(false))).thenReturn(1L);
        when(callLogs.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(any(Instant.class), any()))
                .thenReturn(List.of(row));

        var summary = service.usageSummary(15, 50);
        assertThat(summary.successCount()).isEqualTo(3);
        assertThat(summary.failureCount()).isEqualTo(1);
        assertThat(summary.recent()).hasSize(1);
        assertThat(summary.recent().get(0).operation()).isEqualTo("campaigns.list");
        assertThat(summary.recent().get(0).correlationId()).isEqualTo("c1");
        assertThat(summary.window().from()).isBefore(summary.window().to());
        long windowSeconds = java.time.Duration.between(summary.window().from(), summary.window().to()).getSeconds();
        assertThat(windowSeconds).isBetween(14L * 24 * 3600, 16L * 24 * 3600);
    }

    @Test
    void usageSummaryClampsDaysAndLimit() {
        when(callLogs.countSince(any(Instant.class), eq(true))).thenReturn(0L);
        when(callLogs.countSince(any(Instant.class), eq(false))).thenReturn(0L);
        when(callLogs.findByCreatedAtGreaterThanEqualOrderByCreatedAtDesc(any(Instant.class), any()))
                .thenReturn(List.of());

        var tiny = service.usageSummary(0, 0);
        long tinySeconds = java.time.Duration.between(tiny.window().from(), tiny.window().to()).getSeconds();
        assertThat(tinySeconds).isBetween(0L, 2L * 24 * 3600);

        var wide = service.usageSummary(999, 999);
        long wideSeconds = java.time.Duration.between(wide.window().from(), wide.window().to()).getSeconds();
        assertThat(wideSeconds).isBetween(89L * 24 * 3600, 91L * 24 * 3600);
    }

    @Test
    void listCampaignsMapsFields() {
        ObjectNode c = mapper.createObjectNode()
                .put("id", "cmp1")
                .put("name", "Kedarnath")
                .put("status", "ACTIVE")
                .put("effective_status", "ACTIVE")
                .put("objective", "OUTCOME_LEADS")
                .put("updated_time", "2026-10-01T00:00:00+0000");
        ObjectNode body = mapper.createObjectNode();
        body.putArray("data").add(c);
        when(graph.get(eq("campaigns.list"), eq("act_111"), eq("act_111/campaigns"), anyMap()))
                .thenReturn(body);

        var page = service.listCampaigns("act_111", null, 25);
        assertThat(page.data()).hasSize(1);
        assertThat(page.data().get(0).name()).isEqualTo("Kedarnath");
        assertThat(page.data().get(0).status()).isEqualTo("ACTIVE");
        assertThat(page.data().get(0).objective()).isEqualTo("OUTCOME_LEADS");
        assertThat(page.hasMore()).isFalse();
    }

    @Test
    void listCampaignsExposesPaginationCursor() {
        ObjectNode body = mapper.createObjectNode();
        body.putArray("data").addObject().put("id", "c1").put("name", "A");
        ObjectNode paging = body.putObject("paging");
        paging.putObject("cursors").put("after", "CURSOR_1");
        paging.put("next", "https://graph.facebook.com/v22.0/act_111/campaigns?after=CURSOR_1");

        when(graph.get(eq("campaigns.list"), eq("act_111"), eq("act_111/campaigns"), anyMap()))
                .thenReturn(body);

        var page = service.listCampaigns("act_111", null, 25);
        assertThat(page.hasMore()).isTrue();
        assertThat(page.nextCursor()).isEqualTo("CURSOR_1");

        ArgumentCaptor<Map<String, String>> query = ArgumentCaptor.forClass(Map.class);
        service.listCampaigns("act_111", "CURSOR_1", 25);
        verify(graph, org.mockito.Mockito.atLeastOnce())
                .get(eq("campaigns.list"), eq("act_111"), eq("act_111/campaigns"), query.capture());
        assertThat(query.getAllValues().stream().anyMatch(q -> "CURSOR_1".equals(q.get("after")))).isTrue();
    }

    @Test
    void insightsEmptyPeriodIsEmptyNotSuccessFabrication() {
        when(graph.getAllPages(eq("insights.list"), eq("act_111"), eq("act_111/insights"), anyMap(), anyInt(), any()))
                .thenReturn(List.of());

        var report = service.insights("act_111", "last_7d", null, null, "campaign");
        assertThat(report.rows()).isEmpty();
        assertThat(report.datePreset()).isEqualTo("last_7d");
        assertThat(report.accountId()).isEqualTo("act_111");
    }

    @Test
    void insightsMapsSpendMetrics() {
        ObjectNode row = mapper.createObjectNode()
                .put("campaign_id", "cmp1")
                .put("campaign_name", "Kedarnath")
                .put("impressions", "1000")
                .put("clicks", "40")
                .put("spend", "250.50")
                .put("cpc", "6.26")
                .put("cpm", "250.50")
                .put("ctr", "4.0")
                .put("date_start", "2026-10-01")
                .put("date_stop", "2026-10-07");
        when(graph.getAllPages(eq("insights.list"), eq("act_111"), eq("act_111/insights"), anyMap(), anyInt(), any()))
                .thenReturn(List.of(row));

        var report = service.insights("act_111", "last_7d", null, null, "campaign");
        assertThat(report.rows()).hasSize(1);
        assertThat(report.rows().get(0).spend()).isEqualTo("250.50");
        assertThat(report.rows().get(0).ctr()).isEqualTo("4.0");
    }

    @Test
    void insightsRejectsPresetAndCustomRangeTogether() {
        assertThatThrownBy(() -> service.insights("act_111", "last_7d", "2026-01-01", "2026-01-31", "campaign"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("either datePreset or since/until");
    }

    @Test
    void adsPermissionBlocksCampaignAndInsightCalls() {
        org.mockito.Mockito.doThrow(new ForbiddenException(
                        "Campaigns and insights are disabled. Grant ads_read or ads_management."))
                .when(access).requireAds();

        assertThatThrownBy(() -> service.listCampaigns("act_111", null, 10))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("ads_read");
        assertThatThrownBy(() -> service.insights("act_111", "last_7d", null, null, "campaign"))
                .isInstanceOf(ForbiddenException.class);
        verify(graph, never()).get(anyString(), any(), anyString(), anyMap());
        verify(graph, never()).getAllPages(anyString(), any(), anyString(), anyMap(), anyInt(), any());
    }

    @Test
    void missingAccessTokenFailsClosed() {
        props.getMeta().setAccessToken("");
        assertThatThrownBy(() -> service.listCampaigns("act_111", null, 10))
                .isInstanceOf(ServiceUnavailableException.class)
                .hasMessageContaining("META_ACCESS_TOKEN");
    }

    @Test
    void rejectsPathInjectionInAccountId() {
        assertThatThrownBy(() -> service.listCampaigns("act_111/../me", null, 10))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> service.listCampaigns("act_111/campaigns", null, 10))
                .isInstanceOf(BadRequestException.class);
        verify(graph, never()).get(anyString(), any(), anyString(), anyMap());
    }

    @Test
    void insightsRejectsInvalidLevelAndDateShape() {
        assertThatThrownBy(() -> service.insights("act_111", "last_7d", null, null, "not-a-level"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("level");
        assertThatThrownBy(() -> service.insights("act_111", null, "01-01-2026", "2026-01-31", "campaign"))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("YYYY-MM-DD");
    }
}
