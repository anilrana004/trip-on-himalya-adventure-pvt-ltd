package com.securetravels.crm.face;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface FaceVerificationRepository extends JpaRepository<FaceVerification, UUID> {

    @Query("""
            select v from FaceVerification v
             where v.createdAt >= :from and v.createdAt < :to
             order by v.createdAt desc
            """)
    List<FaceVerification> findBetween(@Param("from") Instant from, @Param("to") Instant to);

    List<FaceVerification> findTop100ByOrderByCreatedAtDesc();
}
