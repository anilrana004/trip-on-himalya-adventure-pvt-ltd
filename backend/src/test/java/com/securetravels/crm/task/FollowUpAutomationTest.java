package com.securetravels.crm.task;

import com.securetravels.crm.automation.zapier.ZapierEventsClient;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.notify.EmailNotifier;
import com.securetravels.crm.lead.Lead;
import com.securetravels.crm.lead.LeadRepository;
import com.securetravels.crm.notification.Notification;
import com.securetravels.crm.notification.NotificationRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FollowUpAutomationTest {

    @Mock private TaskRepository tasks;
    @Mock private UserRepository users;
    @Mock private LeadRepository leads;
    @Mock private NotificationRepository notifications;
    @Mock private EmailNotifier email;
    @Mock private ZapierEventsClient zapier;

    private FollowUpAutomation automation;
    private UUID assignee;
    private User user;

    @BeforeEach
    void setUp() {
        AppProperties props = new AppProperties();
        props.setPublicUrl("http://localhost:3001");
        automation = new FollowUpAutomation(tasks, users, leads, notifications, email, zapier, props);
        assignee = UUID.randomUUID();
        user = new User("sales@securetravels.in", "pw", "Ravi", Role.SALES, "9876500000");
    }

    @Test
    void leadCreatedSchedulesInitialCallAtPlusFiveMinutes() {
        when(tasks.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(assignee)).thenReturn(Optional.of(user));

        Instant now = Instant.now();
        automation.onLeadCreated(UUID.randomUUID(), assignee);

        Task t = captureSavedTasks(1).get(0);
        assertThat(t.getType()).isEqualTo(Task.Type.INITIAL_CALL);
        assertThat(t.getStatus()).isEqualTo(Task.Status.PENDING);
        assertThat(t.getAssigneeId()).isEqualTo(assignee);
        assertThat(t.getDueAt()).isAfter(now.plus(4, ChronoUnit.MINUTES));
        assertThat(t.getDueAt()).isBefore(now.plus(6, ChronoUnit.MINUTES));
        assertThat(t.getSlaDeadline()).isEqualTo(t.getDueAt().plus(1, ChronoUnit.HOURS));

        verify(notifications, times(1)).save(any(Notification.class));
        verify(email).send(eq(user.getEmail()), eq("Call within 5 minutes"), anyString());
    }

    @Test
    void interestedSchedulesFollowUpsAtOneThreeEightFifteenDaySpacing() {
        when(tasks.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(assignee)).thenReturn(Optional.of(user));

        Lead lead = new Lead();
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");

        automation.onInterested(lead);

        List<Task> saved = captureSavedTasks(4);
        assertThat(saved).extracting(Task::getType)
                .containsExactly(Task.Type.FOLLOW_UP_1D, Task.Type.FOLLOW_UP_3D,
                        Task.Type.FOLLOW_UP_8D, Task.Type.FOLLOW_UP_15D);
        // Cadence from mark-interested time: +1, +3 (+2 after FU1), +8 (+5), +15 (+7).
        assertThat(ChronoUnit.DAYS.between(saved.get(0).getDueAt(), saved.get(1).getDueAt())).isEqualTo(2);
        assertThat(ChronoUnit.DAYS.between(saved.get(1).getDueAt(), saved.get(2).getDueAt())).isEqualTo(5);
        assertThat(ChronoUnit.DAYS.between(saved.get(2).getDueAt(), saved.get(3).getDueAt())).isEqualTo(7);
        for (Task t : saved) {
            assertThat(t.getStatus()).isEqualTo(Task.Status.PENDING);
            assertThat(t.getAssigneeId()).isEqualTo(assignee);
            assertThat(t.getSlaDeadline()).isEqualTo(t.getDueAt().plus(24, ChronoUnit.HOURS));
        }
        verify(notifications, times(4)).save(any(Notification.class));
    }

    @Test
    void reEnteringInterestedCancelsOldOpenFollowUpsFirst() {
        when(tasks.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(assignee)).thenReturn(Optional.of(user));
        Task old1d = new Task(UUID.randomUUID(), assignee, Task.Type.FOLLOW_UP_1D,
                Instant.now(), Instant.now().plus(24, ChronoUnit.HOURS));
        Task old15d = new Task(UUID.randomUUID(), assignee, Task.Type.FOLLOW_UP_15D,
                Instant.now(), Instant.now().plus(24, ChronoUnit.HOURS));
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), any(), anyList()))
                .thenReturn(List.of(old1d, old15d));

        Lead lead = new Lead();
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");

        automation.onInterested(lead);

        assertThat(old1d.getStatus()).isEqualTo(Task.Status.CANCELLED);
        assertThat(old15d.getStatus()).isEqualTo(Task.Status.CANCELLED);
        verify(tasks, times(4)).save(any(Task.class));
    }

    @Test
    void quotationSentSchedulesQuotationAtPlusTwoDays() {
        when(tasks.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(assignee)).thenReturn(Optional.of(user));

        Lead lead = new Lead();
        lead.setOwnerId(assignee);
        lead.setCustomerName("Meera");

        automation.onQuotationSent(lead);

        Task t = captureSavedTasks(1).get(0);
        assertThat(t.getType()).isEqualTo(Task.Type.QUOTATION);
        assertThat(t.getStatus()).isEqualTo(Task.Status.PENDING);
        assertThat(t.getSlaDeadline()).isEqualTo(t.getDueAt().plus(24, ChronoUnit.HOURS));
        assertThat(t.getDueAt()).isAfter(Instant.now());
        assertThat(t.getDueAt()).isBefore(Instant.now().plus(3, ChronoUnit.DAYS));
    }

    @Test
    void bookingConfirmationCancelsAllOutstandingAndNotifies() {
        Task open = new Task(UUID.randomUUID(), assignee, Task.Type.FOLLOW_UP_3D,
                Instant.now(), Instant.now().plus(24, ChronoUnit.HOURS));
        when(tasks.findByLeadIdAndStatusIn(any(), anyList())).thenReturn(List.of(open));

        Lead lead = new Lead();
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");

        automation.onBooked(lead);

        assertThat(open.getStatus()).isEqualTo(Task.Status.CANCELLED);
        verify(tasks, never()).save(any(Task.class));
        verify(notifications).save(any(Notification.class));
    }

    @Test
    void lostCancelsPendingAndOverdueTasksAndPublishes() {
        Task pending = new Task(UUID.randomUUID(), assignee, Task.Type.INITIAL_CALL,
                Instant.now(), Instant.now().plus(1, ChronoUnit.HOURS));
        Task overdue = new Task(UUID.randomUUID(), assignee, Task.Type.CALLBACK,
                Instant.now().minus(1, ChronoUnit.HOURS), Instant.now());
        overdue.markOverdue(Instant.now());
        when(tasks.findByLeadIdAndStatusIn(any(), anyList())).thenReturn(List.of(pending, overdue));

        Lead lead = new Lead();
        ReflectionTestUtils.setField(lead, "id", UUID.randomUUID());
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");
        lead.setStatus(Lead.Status.LOST);

        automation.onLost(lead);

        assertThat(pending.getStatus()).isEqualTo(Task.Status.CANCELLED);
        assertThat(overdue.getStatus()).isEqualTo(Task.Status.CANCELLED);
        assertThat(lead.getFollowUpDate()).isNull();
        verify(tasks, never()).save(any(Task.class));
        verify(notifications).save(any(Notification.class));
        verify(zapier).publishAsync(eq("lead.lost"), any());
    }

    @Test
    void interestedCancelsOpenInitialCallAndCallback() {
        when(tasks.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(assignee)).thenReturn(Optional.of(user));
        Task firstCall = new Task(UUID.randomUUID(), assignee, Task.Type.INITIAL_CALL,
                Instant.now(), Instant.now().plus(1, ChronoUnit.HOURS));
        Task callback = new Task(UUID.randomUUID(), assignee, Task.Type.CALLBACK,
                Instant.now(), Instant.now().plus(4, ChronoUnit.HOURS));
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.INITIAL_CALL), anyList()))
                .thenReturn(List.of(firstCall));
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.CALLBACK), anyList()))
                .thenReturn(List.of(callback));
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.FOLLOW_UP_1D), anyList()))
                .thenReturn(List.of());
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.FOLLOW_UP_3D), anyList()))
                .thenReturn(List.of());
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.FOLLOW_UP_8D), anyList()))
                .thenReturn(List.of());
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.FOLLOW_UP_15D), anyList()))
                .thenReturn(List.of());

        Lead lead = new Lead();
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");

        automation.onInterested(lead);

        assertThat(firstCall.getStatus()).isEqualTo(Task.Status.CANCELLED);
        assertThat(callback.getStatus()).isEqualTo(Task.Status.CANCELLED);
        verify(tasks, times(4)).save(any(Task.class));
    }

    @Test
    void softDuplicateSchedulesCallbackWhenNoOpenCallTask() {
        when(tasks.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(assignee)).thenReturn(Optional.of(user));
        when(tasks.existsByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.INITIAL_CALL), anyList()))
                .thenReturn(false);
        when(tasks.existsByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.CALLBACK), anyList()))
                .thenReturn(false);

        Lead lead = new Lead();
        ReflectionTestUtils.setField(lead, "id", UUID.randomUUID());
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");
        lead.setStatus(Lead.Status.NEW);

        automation.onSoftDuplicate(lead);

        Task t = captureSavedTasks(1).get(0);
        assertThat(t.getType()).isEqualTo(Task.Type.CALLBACK);
        assertThat(t.getStatus()).isEqualTo(Task.Status.PENDING);
        assertThat(lead.getFollowUpDate()).isNotNull();
    }

    @Test
    void softDuplicateSkipsWhenOpenInitialCallExists() {
        when(tasks.existsByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.INITIAL_CALL), anyList()))
                .thenReturn(true);

        Lead lead = new Lead();
        ReflectionTestUtils.setField(lead, "id", UUID.randomUUID());
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");
        lead.setStatus(Lead.Status.NEW);

        automation.onSoftDuplicate(lead);

        verify(tasks, never()).save(any(Task.class));
    }

    @Test
    void callOutcomePublishesLeadCallEvent() {
        when(tasks.findByLeadIdAndTypeAndStatusIn(any(), eq(Task.Type.INITIAL_CALL), anyList()))
                .thenReturn(List.of());

        Lead lead = new Lead();
        ReflectionTestUtils.setField(lead, "id", UUID.randomUUID());
        lead.setOwnerId(assignee);
        lead.setCustomerName("Amit");
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(users.findById(assignee)).thenReturn(Optional.of(user));

        automation.onCallOutcome(lead, com.securetravels.crm.lead.LeadCallAttempt.Outcome.CONNECTED);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> dataCaptor = ArgumentCaptor.forClass(Map.class);
        verify(zapier).publishAsync(eq("lead.call"), dataCaptor.capture());
        assertThat(dataCaptor.getValue()).containsEntry("outcome", "CONNECTED");
    }

    private List<Task> captureSavedTasks(int expected) {
        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(tasks, times(expected)).save(captor.capture());
        return captor.getAllValues();
    }
}