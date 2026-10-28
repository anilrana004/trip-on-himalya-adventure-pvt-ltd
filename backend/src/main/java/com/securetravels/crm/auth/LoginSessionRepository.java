package com.securetravels.crm.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface LoginSessionRepository extends JpaRepository<LoginSession, UUID> {

    List<LoginSession> findByUserIdAndLogoutAtIsNullOrderByLoginAtDesc(UUID userId);

    @Query("""
            select s from LoginSession s
             where s.loginAt >= :from and s.loginAt < :to
             order by s.loginAt desc
            """)
    List<LoginSession> findBetween(@Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select s from LoginSession s
             where s.userId in :userIds
               and s.loginAt < :to
               and (s.logoutAt is null or s.logoutAt > :from)
            """)
    List<LoginSession> findOverlapping(@Param("userIds") List<UUID> userIds,
                                       @Param("from") Instant from,
                                       @Param("to") Instant to);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update LoginSession s
               set s.logoutAt = :when, s.logoutReason = :reason
             where s.userId = :userId and s.logoutAt is null
            """)
    int closeOpenByUserId(@Param("userId") UUID userId,
                          @Param("when") Instant when,
                          @Param("reason") String reason);
}
