package com.securetravels.crm.document;

import com.securetravels.crm.booking.Booking;
import com.securetravels.crm.booking.Traveller;
import com.securetravels.crm.booking.TravellerRepository;
import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.notify.EmailNotifier;
import com.securetravels.crm.communications.SendGateService;
import com.securetravels.crm.customer.Customer360Repository;
import com.securetravels.crm.document.dto.TravellerComplianceResponse;
import com.securetravels.crm.notification.NotificationRepository;
import com.securetravels.crm.task.Task;
import com.securetravels.crm.task.TaskRepository;
import com.securetravels.crm.trip.TripRepository;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DocumentMissingReminderServiceTest {

    @Mock ComplianceService compliance;
    @Mock TravellerRepository travellers;
    @Mock TripRepository trips;
    @Mock Customer360Repository customers;
    @Mock TaskRepository tasks;
    @Mock NotificationRepository notifications;
    @Mock UserRepository users;
    @Mock EmailNotifier email;
    @Mock SendGateService sendGate;
    @Mock Booking booking;
    @Mock Traveller traveller;

    AppProperties props;
    DocumentMissingReminderService service;

    @BeforeEach
    void setUp() {
        props = new AppProperties();
        props.setPublicUrl("https://crm.example");
        service = new DocumentMissingReminderService(compliance, travellers, trips, customers, tasks,
                notifications, users, email, sendGate, props);
    }

    @Test
    void createsTaskWhenTravellerNotGreen() {
        UUID bookingId = UUID.randomUUID();
        UUID travellerId = UUID.randomUUID();
        UUID customerId = UUID.randomUUID();

        when(booking.getId()).thenReturn(bookingId);
        when(booking.getBookingRef()).thenReturn("TOH-2026-0001");
        when(booking.getTravelDate()).thenReturn(LocalDate.now().plusDays(10));
        when(booking.getCustomerId()).thenReturn(customerId);
        when(booking.getLeadId()).thenReturn(null);

        when(traveller.getId()).thenReturn(travellerId);
        when(travellers.findByBookingIdOrderByCreatedAtAsc(bookingId)).thenReturn(List.of(traveller));
        when(compliance.travellerSummary(travellerId)).thenReturn(new TravellerComplianceResponse(
                travellerId, "A", 30, bookingId, UUID.randomUUID(), 2, 0, 0, "RED", List.of()));
        when(tasks.findByBookingIdAndTypeAndStatusIn(eq(bookingId), eq(Task.Type.CUSTOM), any()))
                .thenReturn(List.of());

        User ops = new User("ops@example.com", "pw", "Ops", Role.OPS, "9876500001");
        when(users.findFirstByRoleOrderByCreatedAtAsc(Role.OPS)).thenReturn(Optional.of(ops));
        when(tasks.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
        when(customers.findById(customerId)).thenReturn(Optional.empty());

        boolean created = service.ensureReminder(booking);

        assertThat(created).isTrue();
        ArgumentCaptor<Task> taskCap = ArgumentCaptor.forClass(Task.class);
        verify(tasks).save(taskCap.capture());
        assertThat(taskCap.getValue().getNotes()).startsWith(DocumentMissingReminderService.NOTES_LATCH);
        verify(email).send(eq("ops@example.com"), any(), any());
        verify(sendGate, never()).request(any());
    }

    @Test
    void skipsWhenAllGreen() {
        UUID bookingId = UUID.randomUUID();
        UUID travellerId = UUID.randomUUID();
        when(booking.getId()).thenReturn(bookingId);
        when(traveller.getId()).thenReturn(travellerId);
        when(travellers.findByBookingIdOrderByCreatedAtAsc(bookingId)).thenReturn(List.of(traveller));
        when(compliance.travellerSummary(travellerId)).thenReturn(new TravellerComplianceResponse(
                travellerId, "A", 30, bookingId, UUID.randomUUID(), 2, 2, 100, "GREEN", List.of()));
        when(tasks.findByBookingIdAndTypeAndStatusIn(eq(bookingId), eq(Task.Type.CUSTOM), any()))
                .thenReturn(List.of());

        assertThat(service.ensureReminder(booking)).isFalse();
        verify(tasks, never()).save(any());
    }
}
