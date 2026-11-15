package com.securetravels.crm.communications;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.content;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withUnauthorizedRequest;
import static org.springframework.http.HttpMethod.POST;

class MetaWhatsAppGatewayTest {

    private AppProperties props;
    private MockRestServiceServer server;
    private MetaWhatsAppGateway gateway;

    @BeforeEach
    void setUp() {
        props = new AppProperties();
        props.getWhatsApp().setMode(AppProperties.WhatsApp.Mode.META);
        props.getWhatsApp().setPhoneNumberId("100200300");
        props.getWhatsApp().setAccessToken("meta-token");
        props.getWhatsApp().setGraphBaseUrl("https://graph.facebook.com");
        props.getWhatsApp().setGraphApiVersion("v21.0");

        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        gateway = new MetaWhatsAppGateway(builder.build(), new ObjectMapper(), props);
    }

    @Test
    void sendsTemplateViaCloudApi() {
        server.expect(requestTo("https://graph.facebook.com/v21.0/100200300/messages"))
                .andExpect(method(POST))
                .andExpect(header("Authorization", "Bearer meta-token"))
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andRespond(withSuccess("""
                        {"messages":[{"id":"wamid.ABC123"}]}
                        """, MediaType.APPLICATION_JSON));

        WhatsAppGateway.SendResult result = gateway.send(new WhatsAppGateway.SendCommand(
                "+91", "9876543210", "securetravels_lead_follow_up", "en",
                List.of("Kedarkantha", "Anil"), "cb-1"));

        assertThat(result.success()).isTrue();
        assertThat(result.providerMessageId()).isEqualTo("wamid.ABC123");
        server.verify();
    }

    @Test
    void unconfiguredFailsWithoutRetry() {
        props.getWhatsApp().setAccessToken("");
        WhatsAppGateway.SendResult result = gateway.send(new WhatsAppGateway.SendCommand(
                "+91", "9876543210", "tpl", "en", List.of(), null));
        assertThat(result.success()).isFalse();
        assertThat(result.retryable()).isFalse();
        assertThat(result.error()).contains("META_WA");
    }

    @Test
    void unauthorizedIsNotRetryable() {
        server.expect(requestTo("https://graph.facebook.com/v21.0/100200300/messages"))
                .andExpect(method(POST))
                .andRespond(withUnauthorizedRequest());

        WhatsAppGateway.SendResult result = gateway.send(new WhatsAppGateway.SendCommand(
                "+91", "9876543210", "tpl", "en", List.of("a"), null));
        assertThat(result.success()).isFalse();
        assertThat(result.retryable()).isFalse();
        server.verify();
    }
}
