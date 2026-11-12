package com.securetravels.crm.common.notify;

import com.securetravels.crm.communications.email.EmailGateway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class EmailNotifierTest {

    @Mock
    EmailGateway gateway;

    @Test
    void sendDelegatesToEmailGateway() {
        when(gateway.provider()).thenReturn("SES_SANDBOX");
        when(gateway.send(any())).thenReturn(EmailGateway.SendResult.ok("sandbox-1"));
        EmailNotifier notifier = new EmailNotifier(gateway);

        notifier.send("ops@example.com", "Docs missing", "Please chase booking TOH-1");

        ArgumentCaptor<EmailGateway.SendCommand> captor = ArgumentCaptor.forClass(EmailGateway.SendCommand.class);
        verify(gateway).send(captor.capture());
        EmailGateway.SendCommand cmd = captor.getValue();
        assertThat(cmd.toEmail()).isEqualTo("ops@example.com");
        assertThat(cmd.subjectLine()).isEqualTo("Docs missing");
        assertThat(cmd.bodyText()).contains("TOH-1");
        assertThat(cmd.idempotencyKey()).startsWith("staff-mail-");
    }

    @Test
    void blankRecipientIsSkipped() {
        EmailNotifier notifier = new EmailNotifier(gateway);
        notifier.send("  ", "x", "y");
        verify(gateway, never()).send(any());
    }
}
