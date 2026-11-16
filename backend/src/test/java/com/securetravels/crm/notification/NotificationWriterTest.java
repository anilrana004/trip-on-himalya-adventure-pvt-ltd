package com.securetravels.crm.notification;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationWriterTest {

    @Mock private NotificationRepository notifications;
    @InjectMocks private NotificationWriter writer;

    @Test
    void saveOnceSkipsWhenDedupeExists() {
        UUID user = UUID.randomUUID();
        when(notifications.existsByUserIdAndDedupeKey(user, "inbound-msg:1:u")).thenReturn(true);

        boolean wrote = writer.saveOnce(user, "New WhatsApp message", "Hi", "/messages", "inbound-msg:1:u");

        assertThat(wrote).isFalse();
        verify(notifications, never()).save(any());
    }

    @Test
    void saveOncePersistsWithDedupeKey() {
        UUID user = UUID.randomUUID();
        when(notifications.existsByUserIdAndDedupeKey(user, "lead-fu-due:x")).thenReturn(false);
        when(notifications.save(any())).thenAnswer(inv -> inv.getArgument(0));

        boolean wrote = writer.saveOnce(user, "Follow-up due: Asha", "body", "/leads?focus=1", "lead-fu-due:x");

        assertThat(wrote).isTrue();
        ArgumentCaptor<Notification> cap = ArgumentCaptor.forClass(Notification.class);
        verify(notifications).save(cap.capture());
        assertThat(cap.getValue().getDedupeKey()).isEqualTo("lead-fu-due:x");
        assertThat(cap.getValue().getTitle()).contains("Follow-up due");
    }
}
