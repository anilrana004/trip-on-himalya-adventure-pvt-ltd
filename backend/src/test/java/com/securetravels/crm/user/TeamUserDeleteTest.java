package com.securetravels.crm.user;

import com.securetravels.crm.common.audit.AuditAction;
import com.securetravels.crm.common.audit.AuditService;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ConflictException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.vendors.VendorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TeamUserDeleteTest {

    @Mock private UserRepository users;
    @Mock private VendorRepository vendors;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private AuditService auditService;

    private TeamUserService service;
    private UUID adminId;
    private UserPrincipal admin;

    @BeforeEach
    void setUp() {
        service = new TeamUserService(users, vendors, passwordEncoder, auditService);
        adminId = UUID.randomUUID();
        admin = new UserPrincipal(adminId, "admin@toh.in", "Admin", Role.ADMIN, true);
    }

    @Test
    void adminDeletesActiveSalesLogin() {
        User target = userWithId(UUID.randomUUID(), "Ravi", Role.SALES, true);
        when(users.findById(target.getId())).thenReturn(Optional.of(target));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(target.getId(), admin);

        assertThat(target.isActive()).isFalse();
        verify(users).save(target);
        verify(auditService).record(eq("USER"), eq(target.getId()), eq(AuditAction.DELETE),
                eq("active"), eq("true"), org.mockito.ArgumentMatchers.contains("admin@toh.in"));
    }

    @Test
    void managerCannotDelete() {
        User target = userWithId(UUID.randomUUID(), "Ravi", Role.SALES, true);
        UserPrincipal manager = new UserPrincipal(UUID.randomUUID(), "mgr@toh.in", "Mgr", Role.MANAGER, true);

        assertThatThrownBy(() -> service.delete(target.getId(), manager))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("Only admins");
        verify(users, never()).save(any());
    }

    @Test
    void cannotDeleteSelf() {
        User self = userWithId(adminId, "Admin", Role.ADMIN, true);
        when(users.findById(adminId)).thenReturn(Optional.of(self));

        assertThatThrownBy(() -> service.delete(adminId, admin))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("own account");
    }

    @Test
    void adminCannotDeleteCeo() {
        User ceo = userWithId(UUID.randomUUID(), "Boss", Role.CEO, true);
        when(users.findById(ceo.getId())).thenReturn(Optional.of(ceo));

        assertThatThrownBy(() -> service.delete(ceo.getId(), admin))
                .isInstanceOf(ForbiddenException.class)
                .hasMessageContaining("CEO");
    }

    @Test
    void alreadyInactiveRejected() {
        User target = userWithId(UUID.randomUUID(), "Ravi", Role.SALES, false);
        when(users.findById(target.getId())).thenReturn(Optional.of(target));

        assertThatThrownBy(() -> service.delete(target.getId(), admin))
                .isInstanceOf(ConflictException.class);
    }

    @Test
    void ceoCanDeleteAdmin() {
        User target = userWithId(UUID.randomUUID(), "Ops Admin", Role.ADMIN, true);
        UserPrincipal ceo = new UserPrincipal(UUID.randomUUID(), "ceo@toh.in", "CEO", Role.CEO, true);
        when(users.findById(target.getId())).thenReturn(Optional.of(target));
        when(users.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        service.delete(target.getId(), ceo);

        assertThat(target.isActive()).isFalse();
        ArgumentCaptor<String> note = ArgumentCaptor.forClass(String.class);
        verify(auditService).record(eq("USER"), eq(target.getId()), eq(AuditAction.DELETE),
                eq("active"), eq("true"), note.capture());
        assertThat(note.getValue()).contains("ceo@toh.in");
    }

    private static User userWithId(UUID id, String name, Role role, boolean active) {
        User user = new User(name.toLowerCase().replace(' ', '.') + "@toh.in", "hash", name, role, null);
        try {
            Field f = User.class.getDeclaredField("id");
            f.setAccessible(true);
            f.set(user, id);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        user.setActive(active);
        return user;
    }
}
