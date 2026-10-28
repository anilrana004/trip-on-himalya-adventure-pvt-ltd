package com.securetravels.crm.webhook;

import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoundRobinStickyTest {

    @Mock JdbcTemplate jdbc;
    @Mock UserRepository users;

    @Test
    void sameTripSticksToExistingOwnerWithoutAdvancingCursor() {
        UUID tripId = UUID.randomUUID();
        UUID stickyId = UUID.randomUUID();
        User sticky = mock(User.class);
        when(sticky.getId()).thenReturn(stickyId);

        doReturn(List.of(Map.of("owner_id", stickyId)))
                .when(jdbc).queryForList(anyString(), any(Object[].class));
        when(users.findById(stickyId)).thenReturn(Optional.of(sticky));

        RoundRobinService service = new RoundRobinService(jdbc, users);
        User assigned = service.assignForEnquiry(tripId, "Kedarkantha", null);

        assertThat(assigned.getId()).isEqualTo(stickyId);
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void blankEnquiryFallsBackToRoundRobin() {
        UUID salesId = UUID.randomUUID();
        User sales = mock(User.class);
        when(sales.getId()).thenReturn(salesId);

        doReturn(List.of(Map.of("id", salesId)))
                .when(jdbc).queryForList(anyString(), any(Object[].class));
        when(users.findById(salesId)).thenReturn(Optional.of(sales));
        doReturn(1).when(jdbc).update(anyString(), any(Object[].class));

        RoundRobinService service = new RoundRobinService(jdbc, users);
        User assigned = service.assignForEnquiry(null, null, null);

        assertThat(assigned.getId()).isEqualTo(salesId);
        verify(jdbc).update(anyString(), any(Object[].class));
    }

    @Test
    void normalizeDestinationTrimsAndLowercases() {
        assertThat(RoundRobinService.normalizeDestination("  Kedarkantha Trek ")).isEqualTo("kedarkantha trek");
        assertThat(RoundRobinService.normalizeDestination("   ")).isNull();
        assertThat(RoundRobinService.normalizeDestination(null)).isNull();
    }
}
