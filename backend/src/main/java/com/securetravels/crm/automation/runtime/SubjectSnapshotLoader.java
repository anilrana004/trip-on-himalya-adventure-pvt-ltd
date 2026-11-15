package com.securetravels.crm.automation.runtime;

import com.securetravels.crm.automation.field.FieldDef;
import com.securetravels.crm.automation.field.FieldRegistry;
import com.securetravels.crm.automation.field.FieldType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reads the subject row behind a run from the field registry's {@code source}
 * declarations (Phase 6 Module 2). The registry is the ONLY statement of which
 * table/column a field maps to — the loader never sees raw SQL — and values
 * come back normalised per {@link FieldType} so conditions and the executor
 * compare clean values.
 */
@Component
public class SubjectSnapshotLoader {

    private static final String TABLE_BATCH = "batches";

    private final JdbcTemplate jdbc;

    public SubjectSnapshotLoader(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * @return the snapshot, or {@code null} if the subject row no longer exists
     *         (the run is cancelled — there is nothing left to automate).
     */
    public RuntimeSnapshot load(String entity, UUID subjectId) {
        if (subjectId == null) return null;

        Map<String, Object> values = new LinkedHashMap<>();
        Map<String, List<FieldDef>> byTable = new LinkedHashMap<>();

        for (FieldDef field : FieldRegistry.fieldsOf(entity)) {
            String source = field.source();
            if (source == null || source.startsWith("derived:") || source.contains("(")) {
                continue; // enriched after load, or non-column expression
            }
            String[] tableCol = tableColumn(source);
            if (tableCol == null) continue;
            byTable.computeIfAbsent(tableCol[0], t -> new ArrayList<>()).add(field);
        }

        for (Map.Entry<String, List<FieldDef>> e : byTable.entrySet()) {
            String table = e.getKey();
            List<FieldDef> fields = e.getValue();
            String cols = String.join(", ", fields.stream().map(f -> columnOf(f)).toList());
            Map<String, Object> row = jdbc.queryForMap(
                    "SELECT " + cols + " FROM " + table + " WHERE id = ?", subjectId);
            if (row == null || row.isEmpty()) {
                return null;
            }
            for (FieldDef field : fields) {
                Object raw = row.get(columnOf(field));
                values.put(field.name(), normalise(field.type(), raw));
            }
        }

        if (TABLE_BATCH.equalsIgnoreCase(indexTable(entity))) {
            fillPercent(values);
        }
        if (ENTITY_BOOKING.equals(entity)) {
            enrichBooking(values, subjectId);
        }
        if (ENTITY_PAYMENT.equals(entity)) {
            enrichPayment(values, subjectId);
        }

        return new RuntimeSnapshot(entity, subjectId, values);
    }

    private static final String ENTITY_BOOKING = "booking";
    private static final String ENTITY_PAYMENT = "payment";

    private void enrichBooking(Map<String, Object> values, UUID bookingId) {
        try {
            Map<String, Object> row = jdbc.queryForMap("""
                    SELECT b.booking_ref AS booking_ref,
                           COALESCE(NULLIF(c.whatsapp_number, ''), c.mobile_number) AS customer_mobile,
                           c.full_name AS customer_name,
                           t.name AS package_name
                      FROM bookings b
                      LEFT JOIN customer360 c ON c.id = b.customer_id
                      LEFT JOIN trips t ON t.id = b.trip_id
                     WHERE b.id = ?
                    """, bookingId);
            if (row.get("booking_ref") != null) {
                values.put("bookingRef", String.valueOf(row.get("booking_ref")));
            }
            if (row.get("customer_mobile") != null) {
                values.put("customerMobile", String.valueOf(row.get("customer_mobile")));
            }
            if (row.get("customer_name") != null) {
                values.put("customerName", String.valueOf(row.get("customer_name")));
            }
            if (row.get("package_name") != null) {
                values.put("packageName", String.valueOf(row.get("package_name")));
            }
        } catch (Exception ignored) {
            // Snapshot stays usable for conditions even if joins miss.
        }
    }

    private void enrichPayment(Map<String, Object> values, UUID paymentId) {
        try {
            Map<String, Object> row = jdbc.queryForMap("""
                    SELECT b.lead_id AS lead_id,
                           COALESCE(b.created_by, l.owner_id) AS owner_id
                      FROM payments p
                      JOIN bookings b ON b.id = p.booking_id
                      LEFT JOIN leads l ON l.id = b.lead_id
                     WHERE p.id = ?
                    """, paymentId);
            Object leadId = row.get("lead_id");
            if (leadId instanceof UUID u) {
                values.put("leadId", u);
            } else if (leadId != null) {
                values.put("leadId", UUID.fromString(String.valueOf(leadId)));
            }
            Object ownerId = row.get("owner_id");
            if (ownerId instanceof UUID u) {
                values.put("ownerId", u);
            } else if (ownerId != null) {
                values.put("ownerId", UUID.fromString(String.valueOf(ownerId)));
            }
        } catch (Exception ignored) {
            // CREATE_TASK may skip if assignee cannot resolve.
        }
    }

    private void fillPercent(Map<String, Object> values) {
        BigDecimal seats = asDecimal(values.get("seatsBooked"));
        BigDecimal max = asDecimal(values.get("maxCapacity"));
        Integer percent = (seats != null && max != null && max.signum() > 0)
                ? seats.multiply(BigDecimal.valueOf(100)).divideToIntegralValue(max).intValue()
                : 0;
        values.put("fillPercent", BigDecimal.valueOf(percent));
    }

    private BigDecimal asDecimal(Object v) {
        return v == null ? null : v instanceof BigDecimal b ? b : new BigDecimal(String.valueOf(v));
    }

    /** The registry group for an entity name (entities like {@code batch} map
     *  to a physical table whose name differs, e.g. {@code batches}). */
    private String indexTable(String entity) {
        return switch (entity) {
            case "batch" -> TABLE_BATCH;
            case "customer" -> "customer360";
            default -> entity + "s";
        };
    }

    private String[] tableColumn(String source) {
        if (source == null) return null;
        int dot = source.indexOf('.');
        if (dot <= 0 || dot == source.length() - 1) return null;
        return new String[]{ source.substring(0, dot), source.substring(dot + 1) };
    }

    private String columnOf(FieldDef field) {
        String[] tc = tableColumn(field.source());
        return tc == null ? "" : tc[1];
    }

    private Object normalise(FieldType type, Object raw) {
        if (raw == null) return null;
        return switch (type) {
            case TEXT, ENUM -> raw instanceof String s ? s : String.valueOf(raw);
            case NUMBER -> {
                yield raw instanceof BigDecimal b ? b
                        : raw instanceof Number n ? BigDecimal.valueOf(((Number) raw).doubleValue())
                        : new BigDecimal(String.valueOf(raw));
            }
            case BOOLEAN -> raw instanceof Boolean b ? b : "true".equalsIgnoreCase(String.valueOf(raw));
            case DATE -> raw instanceof LocalDate d ? d
                    : raw instanceof java.sql.Date d ? d.toLocalDate()
                    : LocalDate.parse(String.valueOf(raw));
            case DATE_TIME -> raw instanceof Timestamp t ? t.toInstant()
                    : raw instanceof Instant i ? i
                    : raw instanceof java.time.OffsetDateTime o ? o.toInstant()
                    : raw instanceof java.time.LocalDateTime l ? l.toInstant(java.time.ZoneOffset.UTC)
                    : Instant.parse(String.valueOf(raw));
            case UUID -> raw instanceof UUID u ? u
                    : UUID.fromString(String.valueOf(raw));
        };
    }
}