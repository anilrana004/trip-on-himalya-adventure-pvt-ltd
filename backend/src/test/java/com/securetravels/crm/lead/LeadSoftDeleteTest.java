package com.securetravels.crm.lead;

import com.securetravels.crm.common.audit.AuditLogRepository;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.ConflictException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.customer.Customer360Repository;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeadSoftDeleteTest {

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
    private UUID managerId;
    private UserPrincipal manager;

    @BeforeEach
    void setUp() {
        service = new LeadService(leads, users, customers, auditLogRepository, auditService,
                scoringService, automation, roundRobin, accounts, opportunities, callAttempts,
                bookings, tasks, jdbc);
        managerId = UUID.randomUUID();
        manager = new UserPrincipal(managerId, "mgr@toh.in", "Mgr", Role.MANAGER, true);
    }

    @Test
    void archiveSoftDeletesAndClearsFollowUp() {
        Lead lead = newLead();
        lead.scheduleFollowUp(Instant.now().plusSeconds(3600));
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        when(leads.save(any(Lead.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(lead.getId(), "Duplicate enquiry", manager);

        assertThat(lead.isDeleted()).isTrue();
        assertThat(lead.getDeletedBy()).isEqualTo(managerId);
        assertThat(lead.getDeletionReason()).contains("Duplicate");
        assertThat(lead.getFollowUpAt()).isNull();
        verify(automation).clearOpenTasks(lead.getId());
        verify(opportunities).closeOpenForLead(eq(lead.getId()),
                eq(com.securetravels.crm.accounts.Opportunity.Status.LOST), any(), eq(managerId));
    }

    @Test
    void salesCannotArchive() {
        Lead lead = newLead();
        UserPrincipal sales = new UserPrincipal(UUID.randomUUID(), "s@toh.in", "S", Role.SALES, true);
        assertThatThrownBy(() -> service.delete(lead.getId(), null, sales))
                .isInstanceOf(ForbiddenException.class);
    }

    @Test
    void restoreRequiresAdmin() {
        Lead lead = newLead();
        lead.softDelete(managerId, "test");
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));

        assertThatThrownBy(() -> service.restore(lead.getId(), manager))
                .isInstanceOf(ForbiddenException.class);

        UserPrincipal admin = new UserPrincipal(UUID.randomUUID(), "a@toh.in", "A", Role.ADMIN, true);
        when(leads.save(any(Lead.class))).thenAnswer(inv -> inv.getArgument(0));
        when(users.findById(any())).thenReturn(Optional.empty());
        var restored = service.restore(lead.getId(), admin);
        assertThat(lead.isDeleted()).isFalse();
        assertThat(restored.id()).isEqualTo(lead.getId());
    }

    @Test
    void doubleArchiveRejected() {
        Lead lead = newLead();
        lead.softDelete(managerId, "once");
        when(leads.findById(lead.getId())).thenReturn(Optional.of(lead));
        assertThatThrownBy(() -> service.delete(lead.getId(), null, manager))
                .isInstanceOf(ConflictException.class);
    }

    private static Lead newLead() {
        Lead lead = new Lead();
        try {
            Field f = Lead.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(lead, UUID.randomUUID());
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        lead.setCustomerName("Guest");
        lead.setMobileNumber("9876500001");
        lead.setMobileDigits("9876500001");
        lead.setOwnerId(UUID.randomUUID());
        lead.setStatus(Lead.Status.NEW);
        return lead;
    }
}
