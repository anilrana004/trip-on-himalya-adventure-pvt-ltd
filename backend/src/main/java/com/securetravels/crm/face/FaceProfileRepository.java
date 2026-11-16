package com.securetravels.crm.face;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FaceProfileRepository extends JpaRepository<FaceProfile, UUID> {

    Optional<FaceProfile> findByUserIdAndActiveTrue(UUID userId);

    List<FaceProfile> findByUserIdInAndActiveTrue(Collection<UUID> userIds);

    List<FaceProfile> findByActiveTrue();
}
