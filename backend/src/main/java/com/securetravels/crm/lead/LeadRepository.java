package com.securetravels.crm.lead;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LeadRepository extends JpaRepository<Lead, UUID> {

    long countByAccountId(UUID accountId);

    /** Duplicate detection key — first non-LOST lead sharing the phone. */
    @Query("""
            select l from Lead l
            where l.mobileDigits = :digits
              and l.deletedAt is null
              and l.status <> com.securetravels.crm.lead.Lead.Status.LOST
            order by l.createdAt desc
            limit 1
            """)
    Optional<Lead> findFirstActiveDuplicate(@Param("digits") String digits);

    /** Soft match when phone differs but email is the same active person. */
    @Query("""
            select l from Lead l
            where lower(l.email) = lower(:email)
              and l.deletedAt is null
              and l.status <> com.securetravels.crm.lead.Lead.Status.LOST
            order by l.createdAt desc
            limit 1
            """)
    Optional<Lead> findFirstActiveDuplicateByEmail(@Param("email") String email);

    Optional<Lead> findByMetaLeadId(String metaLeadId);

    /** Open leads with follow-up due in [from, to). Sales book when ownerId set. */
    @Query("""
            select l from Lead l
            where l.followUpAt is not null
              and l.deletedAt is null
              and l.followUpAt >= :from
              and l.followUpAt < :to
              and l.status not in (
                  com.securetravels.crm.lead.Lead.Status.LOST,
                  com.securetravels.crm.lead.Lead.Status.BOOKING_CONFIRMED)
              and (:ownerId is null or l.ownerId = :ownerId)
            order by l.followUpAt asc
            """)
    List<Lead> findFollowUpsBetween(@Param("from") Instant from,
                                    @Param("to") Instant to,
                                    @Param("ownerId") UUID ownerId);

    /** Still open and past due (before start of today). */
    @Query("""
            select l from Lead l
            where l.followUpAt is not null
              and l.deletedAt is null
              and l.followUpAt < :before
              and l.status not in (
                  com.securetravels.crm.lead.Lead.Status.LOST,
                  com.securetravels.crm.lead.Lead.Status.BOOKING_CONFIRMED)
              and (:ownerId is null or l.ownerId = :ownerId)
            order by l.followUpAt asc
            """)
    List<Lead> findFollowUpsOverdue(@Param("before") Instant before,
                                    @Param("ownerId") UUID ownerId);

    /** Recently completed follow-ups (for the desk history bucket). */
    @Query("""
            select l from Lead l
            where l.followUpCompletedAt is not null
              and l.deletedAt is null
              and l.followUpCompletedAt >= :from
              and l.followUpCompletedAt < :to
              and (:ownerId is null or l.ownerId = :ownerId)
            order by l.followUpCompletedAt desc
            """)
    List<Lead> findFollowUpsCompleted(@Param("from") Instant from,
                                      @Param("to") Instant to,
                                      @Param("ownerId") UUID ownerId);

    /**
     * Due follow-ups that still need a reminder: dueAt &lt;= now, not yet notified
     * for this occurrence (notified_at null or before the scheduled instant).
     */
    @Query("""
            select l from Lead l
            where l.followUpAt is not null
              and l.deletedAt is null
              and l.followUpAt <= :now
              and l.ownerId is not null
              and l.status not in (
                  com.securetravels.crm.lead.Lead.Status.LOST,
                  com.securetravels.crm.lead.Lead.Status.BOOKING_CONFIRMED)
              and (l.followUpNotifiedAt is null or l.followUpNotifiedAt < l.followUpAt)
            order by l.followUpAt asc
            """)
    List<Lead> findDueForReminder(@Param("now") Instant now);

    /** Open leads that have gone quiet — used by inactive-lead nudge sweep. */
    @Query("""
            select l from Lead l
            where l.status in :statuses
              and l.deletedAt is null
              and l.ownerId is not null
              and (l.lastContactedAt is null or l.lastContactedAt < :quietSince)
              and l.createdAt < :createdBefore
            order by l.createdAt asc
            """)
    java.util.List<Lead> findInactiveForNudge(
            @Param("statuses") java.util.Collection<Lead.Status> statuses,
            @Param("quietSince") java.time.Instant quietSince,
            @Param("createdBefore") java.time.Instant createdBefore);

    @Query(value = """
            select l.source as source,
                   count(*) as total,
                   count(*) filter (where l.status in ('NEW', 'INTERESTED')) as open,
                   count(*) filter (where l.status = 'QUOTATION_SENT') as quoted,
                   count(*) filter (where l.status = 'BOOKING_CONFIRMED') as booked,
                   count(*) filter (where l.status = 'LOST') as lost
            from leads l
            where l.deleted_at is null
              and (CAST(:ownerId AS uuid) is null or l.owner_id = :ownerId)
            group by l.source
            order by count(*) desc
            """, nativeQuery = true)
    java.util.List<LeadSourceCount> countBySource(@Param("ownerId") UUID ownerId);

    /**
     * Filtered listing of active (non-archived) leads. All parameters optional.
     */
    @Query(value = """
            select * from leads l
            where l.deleted_at is null
              and (CAST(:ownerId AS uuid) is null or l.owner_id = :ownerId)
              and (CAST(:status AS varchar) is null or l.status = :status)
              and (CAST(:source AS varchar) is null or l.source = :source)
              and (CAST(:heat AS varchar) is null or l.heat = :heat)
              and (CAST(:tripId AS uuid) is null or l.trip_id = :tripId)
              and (CAST(:from AS timestamptz) is null or l.created_at >= :from)
              and (CAST(:to AS timestamptz) is null or l.created_at < :to)
              and (CAST(:travelFrom AS date) is null or l.travel_date >= :travelFrom)
              and (CAST(:travelTo AS date) is null or l.travel_date <= :travelTo)
              and (CAST(:search AS varchar) is null or lower(l.customer_name) like lower('%' || :search || '%')
                   or l.mobile_digits like '%' || :search || '%')
            order by l.created_at desc
            """,
            countQuery = """
            select count(*) from leads l
            where l.deleted_at is null
              and (CAST(:ownerId AS uuid) is null or l.owner_id = :ownerId)
              and (CAST(:status AS varchar) is null or l.status = :status)
              and (CAST(:source AS varchar) is null or l.source = :source)
              and (CAST(:heat AS varchar) is null or l.heat = :heat)
              and (CAST(:tripId AS uuid) is null or l.trip_id = :tripId)
              and (CAST(:from AS timestamptz) is null or l.created_at >= :from)
              and (CAST(:to AS timestamptz) is null or l.created_at < :to)
              and (CAST(:travelFrom AS date) is null or l.travel_date >= :travelFrom)
              and (CAST(:travelTo AS date) is null or l.travel_date <= :travelTo)
              and (CAST(:search AS varchar) is null or lower(l.customer_name) like lower('%' || :search || '%')
                   or l.mobile_digits like '%' || :search || '%')
            """,
            nativeQuery = true)
    Page<Lead> search(@Param("ownerId") UUID ownerId,
                      @Param("status") String status,
                      @Param("source") String source,
                      @Param("heat") String heat,
                      @Param("tripId") UUID tripId,
                      @Param("from") java.time.Instant from,
                      @Param("to") java.time.Instant to,
                      @Param("travelFrom") LocalDate travelFrom,
                      @Param("travelTo") LocalDate travelTo,
                      @Param("search") String search,
                      Pageable pageable);
}