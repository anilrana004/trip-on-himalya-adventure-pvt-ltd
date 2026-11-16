package com.securetravels.crm.lead;

import com.securetravels.crm.common.audit.AuditLogRepository;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.customer.Customer360Repository;
import com.securetravels.crm.lead.dto.FollowUpActionRequest;
import com.securetravels.crm.lead.dto.TodayFollowUpsResponse;
import com.securetravels.crm.task.FollowUpAutomation;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Field;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeadFollowUpDeskTest {

    @Mock private LeadRepository leads;
    @Mock private UserRepository users;
    @Mock private Customer360Repository customers;
    @Mock private AuditLogRepository auditLogRepository;
    @Mock private AuditService auditService;
    @Mock private LeadScoringService scoringService;
    @Mock private FollowUpAutomation automation;
    @Mock private com.securetravels.crm.webhook.RoundRobinService roundRobin;
    @Mock private com.securetravels.crm.accounts.AccountService accounts;
    @Mock private com.securetravels.crm.accounts.OpportunityService opportunities;
    @Mock private LeadCallAttemptRepository callAttempts;
    @Mock private com.securetravels.crm.booking.BookingRepository bookings;
    @Mock private com.securetravels.crm.task.TaskRepository tasks;
    @Mock private org.springframework.jdbc.core.JdbcTemplate jdbc;

    private LeadService service;
    private UUID salesId;
    private UserPrincipal sales;

    @BeforeEach
    void setUp() {
        service = new LeadService(leads, users, customers, auditLogRepository, auditService,
                scoringService, automation, roundRobin, accounts, opportunities, callAttempts,
                bookings, tasks, jdbc);
        salesId = UUID.randomUUID();
        sales = new UserPrincipal(salesId, "sales@toh.in", "Ravi", Role.SALES, true);
    }

    @Test
    void todayDeskBucketsUseIstAndOwnerScope() {
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        LocalDate today = LocalDate.now(ist);
        Instant dayStart = today.atStartOfDay(ist).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ist).toInstant();
        Instant upcomingEnd = today.plusDays(7).atStartOfDay(ist).toInstant();
        Instant completedFrom = today.minusDays(14).atStartOfDay(ist).toInstant();

        Lead due = leadWithFollowUp(salesId, dayStart.plusSeconds(3600));
        when(leads.findFollowUpsOverdue(eq(dayStart), eq(salesId))).thenReturn(List.of());
        when(leads.findFollowUpsBetween(eq(dayStart), eq(dayEnd), eq(salesId))).thenReturn(List.of(due));
        when(leads.findFollowUpsBetween(eq(dayEnd), eq(upcomingEnd), eq(salesId))).thenReturn(List.of());
        when(leads.findFollowUpsCompleted(eq(completedFrom), eq(dayEnd), eq(salesId))).thenReturn(List.of());
        when(users.findById(any())).thenReturn(Optional.empty());

        TodayFollowUpsResponse desk = service.todayFollowUps(null, sales);

        assertThat(desk.dueTodayCount()).isEqualTo(1);
        assertThat(desk.overdueCount()).isZero();
        assertThat(desk.upcomingCount()).isZero();
        assertThat(desk.completedCount()).isZero();
        assertThat(desk.dueToday()).hasSize(1);
        verify(leads).findFollowUpsBetween(eq(dayStart), eq(dayEnd), eq(salesId));
    }

    @Test
    void completeClearsPendingFollowUp() {
        Lead lead = leadWithFollowUp(salesId, Instant.now().plusSeconds(3600));
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(leads.save(any(Lead.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(any())).thenReturn(Optional.empty());

        var response = service.completeFollowUp(lead.getId(),
                new FollowUpActionRequest(null, "Called — will quote tomorrow"), sales);

        assertThat(lead.getFollowUpAt()).isNull();
        assertThat(lead.getFollowUpCompletedAt()).isNotNull();
        assertThat(lead.getFollowUpNotes()).contains("quote");
        assertThat(response.followUpCompletedAt()).isNotNull();
    }

    @Test
    void rescheduleMovesFollowUpAndClearsNotifiedLatch() {
        Lead lead = leadWithFollowUp(salesId, Instant.now().plusSeconds(3600));
        lead.setFollowUpNotifiedAt(Instant.now());
        Instant next = Instant.now().plusSeconds(86_400);
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(leads.save(any(Lead.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(any())).thenReturn(Optional.empty());

        service.rescheduleFollowUp(lead.getId(), new FollowUpActionRequest(next, "Call after trek brief"), sales);

        assertThat(lead.getFollowUpAt()).isEqualTo(next);
        assertThat(lead.getFollowUpNotifiedAt()).isNull();
        assertThat(lead.getFollowUpCompletedAt()).isNull();
        assertThat(lead.getFollowUpNotes()).contains("trek");
    }

    @Test
    void managerCanScopeTeamOrOneOwner() {
        UUID other = UUID.randomUUID();
        UserPrincipal manager = new UserPrincipal(UUID.randomUUID(), "m@toh.in", "Mgr", Role.MANAGER, true);
        ZoneId ist = ZoneId.of("Asia/Kolkata");
        LocalDate today = LocalDate.now(ist);
        Instant dayStart = today.atStartOfDay(ist).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(ist).toInstant();
        Instant upcomingEnd = today.plusDays(7).atStartOfDay(ist).toInstant();
        Instant completedFrom = today.minusDays(14).atStartOfDay(ist).toInstant();
        when(leads.findFollowUpsOverdue(eq(dayStart), eq(other))).thenReturn(List.of());
        when(leads.findFollowUpsBetween(eq(dayStart), eq(dayEnd), eq(other))).thenReturn(List.of());
        when(leads.findFollowUpsBetween(eq(dayEnd), eq(upcomingEnd), eq(other))).thenReturn(List.of());
        when(leads.findFollowUpsCompleted(eq(completedFrom), eq(dayEnd), eq(other))).thenReturn(List.of());

        TodayFollowUpsResponse desk = service.todayFollowUps(other, manager);
        assertThat(desk.dueTodayCount()).isZero();
        verify(leads).findFollowUpsOverdue(eq(dayStart), eq(other));
        verify(leads).findFollowUpsBetween(eq(dayStart), eq(dayEnd), eq(other));
    }

    private static Lead leadWithFollowUp(UUID ownerId, Instant at) {
        Lead lead = new Lead();
        setId(lead, UUID.randomUUID());
        lead.setCustomerName("Test Guest");
        lead.setMobileNumber("9876500001");
        lead.setMobileDigits("9876500001");
        lead.setOwnerId(ownerId);
        lead.setStatus(Lead.Status.INTERESTED);
        lead.setHeat(Lead.Heat.HOT);
        lead.scheduleFollowUp(at);
        return lead;
    }

    private static void setId(Lead lead, UUID id) {
        try {
            Field f = Lead.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(lead, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }
}
