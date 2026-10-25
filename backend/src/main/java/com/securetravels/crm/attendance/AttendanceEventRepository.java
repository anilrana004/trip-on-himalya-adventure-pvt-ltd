package com.securetravels.crm.attendance;

import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AttendanceEventRepository extends JpaRepository<AttendanceEvent, UUID> {

    Optional<AttendanceEvent> findByClientEventId(UUID clientEventId);

    List<AttendanceEvent> findByUserIdAndWorkDateOrderByServerTimeAsc(UUID userId, LocalDate workDate);

    List<AttendanceEvent> findByUserIdAndWorkDateBetweenOrderByServerTimeAsc(
            UUID userId, LocalDate from, LocalDate to);

    long countByUserIdAndWorkDate(UUID userId, LocalDate workDate);
}
