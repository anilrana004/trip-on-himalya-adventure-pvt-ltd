package com.securetravels.crm.incident;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FieldIncidentRepository extends JpaRepository<FieldIncident, UUID> {

    List<FieldIncident> findTop200ByOrderByCreatedAtDesc();
}
