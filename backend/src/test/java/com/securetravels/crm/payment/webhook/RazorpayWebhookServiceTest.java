package com.securetravels.crm.payment.webhook;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.exception.WebhookSignatureException;
import com.securetravels.crm.common.security.HmacSigner;
import com.securetravels.crm.payment.PaymentService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RazorpayWebhookServiceTest {

    @Mock
    PaymentService payments;

    AppProperties props;
    RazorpayWebhookService service;

    @BeforeEach
    void setUp() {
        props = new AppProperties();
        props.getPayments().setRazorpayWebhookSecret("test-razorpay-secret");
        service = new RazorpayWebhookService(props, new ObjectMapper(), payments);
    }

    @Test
    void paymentCapturedCompletesByGatewayRef() {
        String body = """
                {"event":"payment.captured","payload":{"payment":{"entity":{"id":"pay_ABC","created_at":1700000000}}}}
                """;
        byte[] raw = body.getBytes(StandardCharsets.UTF_8);
        String sig = HmacSigner.computeHex("test-razorpay-secret", raw);
        when(payments.confirmFromGateway(eq("pay_ABC"), any(Instant.class))).thenReturn(true);

        int applied = service.handle(raw, sig);

        assertThat(applied).isEqualTo(1);
        verify(payments).confirmFromGateway(eq("pay_ABC"), any(Instant.class));
    }

    @Test
    void badSignatureRejected() {
        byte[] raw = "{\"event\":\"payment.captured\"}".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> service.handle(raw, "deadbeef"))
                .isInstanceOf(WebhookSignatureException.class);
    }

    @Test
    void blankSecretFailsClosed() {
        props.getPayments().setRazorpayWebhookSecret("");
        byte[] raw = "{}".getBytes(StandardCharsets.UTF_8);
        assertThatThrownBy(() -> service.handle(raw, "anything"))
                .isInstanceOf(WebhookSignatureException.class);
    }
}
