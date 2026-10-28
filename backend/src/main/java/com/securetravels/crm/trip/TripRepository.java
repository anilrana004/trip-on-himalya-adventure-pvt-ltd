package com.securetravels.crm.trip;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface TripRepository extends JpaRepository<Trip, UUID> {

    @org.springframework.data.jpa.repository.Query("""
            select t from Trip t
            where t.active = true
              and (
                   lower(t.name) = lower(:q)
                or lower(t.slug) = lower(:q)
                or lower(t.name) like lower(concat('%', :q, '%'))
                or lower(:q) like lower(concat('%', t.name, '%'))
              )
            order by length(t.name) asc
            """)
    java.util.List<Trip> findActiveNameMatches(@org.springframework.data.repository.query.Param("q") String q,
                                               org.springframework.data.domain.Pageable pageable);
    List<Trip> findAllByActiveTrueOrderByNameAsc();
    List<Trip> findAllByActiveFalseOrderByNameAsc();
    List<Trip> findAllByOrderByNameAsc();
    Optional<Trip> findBySlug(String slug);
}