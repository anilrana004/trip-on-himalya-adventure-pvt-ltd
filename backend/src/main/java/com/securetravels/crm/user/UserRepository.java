package com.securetravels.crm.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {

    Optional<User> findByEmailIgnoreCase(String email);

    boolean existsByEmailIgnoreCase(String email);

    boolean existsByVendorId(UUID vendorId);

    Optional<User> findFirstByRoleOrderByCreatedAtAsc(Role role);

    List<User> findAllByRoleOrderByCreatedAtAsc(Role role);

    List<User> findAllByOrderByFullNameAsc();

    List<User> findByReportsToOrderByFullNameAsc(UUID reportsTo);

    List<User> findByIsActiveTrueAndRoleIn(java.util.Collection<Role> roles);
}