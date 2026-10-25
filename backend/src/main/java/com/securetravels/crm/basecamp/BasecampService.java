package com.securetravels.crm.basecamp;

import com.securetravels.crm.attendance.AttendanceEventType;
import com.securetravels.crm.attendance.AttendanceService;
import com.securetravels.crm.attendance.dto.AttendanceDayResponse;
import com.securetravels.crm.attendance.dto.PunchRequest;
import com.securetravels.crm.common.exception.BadRequestException;
import com.securetravels.crm.common.exception.ForbiddenException;
import com.securetravels.crm.common.exception.NotFoundException;
import com.securetravels.crm.common.util.PhoneUtils;
import com.securetravels.crm.common.util.XssSanitizer;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import com.securetravels.crm.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class BasecampService {

    private static final Set<Role> MANAGERS = EnumSet.of(Role.MANAGER, Role.ADMIN, Role.CEO);
    private static final Set<Role> OPS = EnumSet.of(Role.OPS, Role.MANAGER, Role.ADMIN, Role.CEO);
    private static final Set<Role> INVENTORY_READ = EnumSet.of(Role.OPS, Role.MANAGER, Role.ADMIN, Role.CEO, Role.FINANCE);
    private static final Set<Role> PAYROLL = EnumSet.of(Role.ADMIN, Role.CEO);
    private static final Set<Role> SETTINGS = EnumSet.of(Role.ADMIN, Role.CEO);
    /** Non-secret company profile — readable by all CRM staff (sales screenshot). */
    private static final Set<Role> SETTINGS_READ = EnumSet.of(
            Role.SALES, Role.OPS, Role.MANAGER, Role.ADMIN, Role.CEO, Role.FINANCE);
    private static final Set<String> ALLOWED_SETTINGS = Set.of(
            "company.legal_name", "company.trade_name", "company.gstin",
            "company.support_email", "company.support_phone", "company.timezone",
            "company.address", "company.website");

    private final AttendanceService attendance;
    private final StaffLeaveRequestRepository leaves;
    private final StaffPayrollRepository payroll;
    private final InventoryItemRepository inventory;
    private final VisitorLogRepository visitors;
    private final CompanySettingRepository settings;
    private final UserRepository users;

    public BasecampService(AttendanceService attendance, StaffLeaveRequestRepository leaves,
                           StaffPayrollRepository payroll, InventoryItemRepository inventory,
                           VisitorLogRepository visitors, CompanySettingRepository settings,
                           UserRepository users) {
        this.attendance = attendance;
        this.leaves = leaves;
        this.payroll = payroll;
        this.inventory = inventory;
        this.visitors = visitors;
        this.settings = settings;
        this.users = users;
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listAttendance(UserPrincipal caller, LocalDate from, LocalDate to) {
        return attendance.listDays(caller, from, to).stream().map(this::attendanceMap).toList();
    }

    /**
     * Legacy punch body. The work date and status are ignored: the server
     * dates the punch in Asia/Kolkata and appends an event instead of
     * overwriting the day.
     */
    @Transactional
    public Map<String, Object> upsertAttendance(UserPrincipal caller, UUID userId, LocalDate workDate,
                                                StaffAttendance.Status status, String notes,
                                                boolean checkIn, boolean checkOut) {
        if (!checkIn && !checkOut) {
            throw new BadRequestException("Check in or check out is required");
        }
        AttendanceDayResponse day = null;
        if (checkIn) {
            day = attendance.punch(caller, new PunchRequest(
                    userId, AttendanceEventType.CHECK_IN, null, null, notes));
        }
        if (checkOut) {
            day = attendance.punch(caller, new PunchRequest(
                    userId, AttendanceEventType.CHECK_OUT, null, null, notes));
        }
        if (day == null) {
            throw new BadRequestException("Check in or check out is required");
        }
        return attendanceMap(day);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listLeave(UserPrincipal caller) {
        requireStaff(caller);
        Map<UUID, String> names = userNames();
        List<StaffLeaveRequest> rows = MANAGERS.contains(caller.role())
                ? leaves.findAllByOrderByCreatedAtDesc()
                : leaves.findByUserIdOrderByCreatedAtDesc(caller.id());
        return rows.stream().map(l -> leaveMap(l, names)).toList();
    }

    @Transactional
    public Map<String, Object> createLeave(UserPrincipal caller, StaffLeaveRequest.LeaveType type,
                                           LocalDate from, LocalDate to, String reason,
                                           StaffLeaveRequest.Portion portion) {
        requireStaff(caller);
        if (from == null || to == null || to.isBefore(from)) {
            throw new BadRequestException("Invalid leave date range");
        }
        StaffLeaveRequest.Portion span = portion == null ? StaffLeaveRequest.Portion.FULL : portion;
        if (span != StaffLeaveRequest.Portion.FULL && !from.equals(to)) {
            throw new BadRequestException("A half-day leave is a single date");
        }
        StaffLeaveRequest row = new StaffLeaveRequest(caller.id(), type, from, to);
        row.setPortion(span);
        row.setReason(XssSanitizer.text(reason));
        return leaveMap(leaves.save(row), userNames());
    }

    @Transactional
    public Map<String, Object> reviewLeave(UUID id, StaffLeaveRequest.Status status, String note,
                                           UserPrincipal caller) {
        if (!MANAGERS.contains(caller.role())) {
            throw new ForbiddenException("Only managers can approve leave");
        }
        if (status != StaffLeaveRequest.Status.APPROVED && status != StaffLeaveRequest.Status.REJECTED) {
            throw new BadRequestException("Review status must be APPROVED or REJECTED");
        }
        StaffLeaveRequest row = leaves.findById(id)
                .orElseThrow(() -> new NotFoundException("Leave request not found"));
        row.setStatus(status);
        row.setReviewedBy(caller.id());
        row.setReviewedAt(Instant.now());
        row.setReviewNote(XssSanitizer.text(note));
        leaves.saveAndFlush(row);
        attendance.rebuildRange(row.getUserId(), row.getFromDate(), row.getToDate());
        return leaveMap(row, userNames());
    }

    @Transactional
    public Map<String, Object> cancelLeave(UUID id, UserPrincipal caller) {
        StaffLeaveRequest row = leaves.findById(id)
                .orElseThrow(() -> new NotFoundException("Leave request not found"));
        boolean owner = row.getUserId().equals(caller.id());
        boolean manager = MANAGERS.contains(caller.role());
        if (row.getStatus() == StaffLeaveRequest.Status.PENDING && (owner || manager)) {
            row.setStatus(StaffLeaveRequest.Status.CANCELLED);
        } else if (row.getStatus() == StaffLeaveRequest.Status.APPROVED && manager) {
            row.setStatus(StaffLeaveRequest.Status.CANCELLED);
        } else {
            throw new ForbiddenException("This leave cannot be cancelled");
        }
        row.setReviewedBy(caller.id());
        row.setReviewedAt(Instant.now());
        leaves.saveAndFlush(row);
        attendance.rebuildRange(row.getUserId(), row.getFromDate(), row.getToDate());
        return leaveMap(row, userNames());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listPayroll(UserPrincipal caller, String month) {
        if (!PAYROLL.contains(caller.role()) && caller.role() != Role.MANAGER && caller.role() != Role.FINANCE) {
            throw new ForbiddenException("Payroll is restricted");
        }
        String m = month != null ? month : java.time.YearMonth.now().toString();
        Map<UUID, String> names = userNames();
        return payroll.findByPeriodMonthOrderByCreatedAtDesc(m).stream()
                .map(p -> payrollMap(p, names))
                .toList();
    }

    @Transactional
    public Map<String, Object> upsertPayroll(UserPrincipal caller, UUID userId, String periodMonth,
                                             BigDecimal basic, BigDecimal allowances, BigDecimal deductions,
                                             StaffPayroll.Status status, String notes) {
        if (!PAYROLL.contains(caller.role())) {
            throw new ForbiddenException("Only ADMIN/CEO can edit payroll");
        }
        if (userId == null || periodMonth == null || periodMonth.isBlank()) {
            throw new BadRequestException("userId and periodMonth required");
        }
        StaffPayroll row = payroll.findByUserIdAndPeriodMonth(userId, periodMonth)
                .orElseGet(() -> new StaffPayroll(userId, periodMonth));
        row.setBasicPay(nz(basic));
        row.setAllowances(nz(allowances));
        row.setDeductions(nz(deductions));
        row.recalculate();
        if (status != null) row.setStatus(status);
        row.setNotes(XssSanitizer.text(notes));
        row.setRecordedBy(caller.id());
        return payrollMap(payroll.save(row), userNames());
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listInventory(UserPrincipal caller) {
        if (!INVENTORY_READ.contains(caller.role())) {
            throw new ForbiddenException("Inventory access requires ops or above");
        }
        return inventory.findByActiveTrueOrderByNameAsc().stream().map(this::inventoryMap).toList();
    }

    @Transactional
    public Map<String, Object> createInventory(UserPrincipal caller, String sku, String name,
                                               InventoryItem.Category category, BigDecimal quantity,
                                               String unit, BigDecimal reorderLevel, String location, String notes) {
        if (!OPS.contains(caller.role())) {
            throw new ForbiddenException("Inventory write requires ops or above");
        }
        String cleanSku = XssSanitizer.text(sku);
        if (cleanSku == null || cleanSku.isBlank()) throw new BadRequestException("SKU required");
        if (inventory.existsBySkuIgnoreCase(cleanSku)) throw new BadRequestException("SKU already exists");
        InventoryItem item = new InventoryItem(cleanSku.toUpperCase(), XssSanitizer.text(name),
                category != null ? category : InventoryItem.Category.GEAR);
        item.setQuantity(nz(quantity));
        item.setUnit(unit != null ? unit : "NOS");
        item.setReorderLevel(nz(reorderLevel));
        item.setLocation(XssSanitizer.text(location));
        item.setNotes(XssSanitizer.text(notes));
        item.setRecordedBy(caller.id());
        return inventoryMap(inventory.save(item));
    }

    @Transactional
    public Map<String, Object> adjustInventory(UUID id, BigDecimal quantity, UserPrincipal caller) {
        if (!OPS.contains(caller.role())) {
            throw new ForbiddenException("Inventory write requires ops or above");
        }
        InventoryItem item = inventory.findById(id)
                .orElseThrow(() -> new NotFoundException("Inventory item not found"));
        if (quantity == null || quantity.signum() < 0) throw new BadRequestException("quantity must be >= 0");
        item.setQuantity(quantity);
        item.setRecordedBy(caller.id());
        return inventoryMap(inventory.save(item));
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> listVisitors(UserPrincipal caller) {
        if (!OPS.contains(caller.role())) {
            throw new ForbiddenException("Visitor log requires ops or above");
        }
        Map<UUID, String> names = userNames();
        return visitors.findAllByOrderByCheckedInAtDesc().stream()
                .limit(200)
                .map(v -> visitorMap(v, names))
                .toList();
    }

    @Transactional
    public Map<String, Object> checkInVisitor(UserPrincipal caller, String name, String phone,
                                              String purpose, UUID hostUserId, String notes) {
        if (!OPS.contains(caller.role())) {
            throw new ForbiddenException("Visitor check-in requires ops or above");
        }
        VisitorLog v = new VisitorLog(XssSanitizer.text(name), XssSanitizer.text(purpose));
        String normalized = PhoneUtils.normalize(phone);
        v.setPhone(normalized);
        v.setHostUserId(hostUserId != null ? hostUserId : caller.id());
        v.setNotes(XssSanitizer.text(notes));
        v.setRecordedBy(caller.id());
        return visitorMap(visitors.save(v), userNames());
    }

    @Transactional
    public Map<String, Object> checkOutVisitor(UUID id, UserPrincipal caller) {
        if (!OPS.contains(caller.role())) {
            throw new ForbiddenException("Visitor check-out requires ops or above");
        }
        VisitorLog v = visitors.findById(id).orElseThrow(() -> new NotFoundException("Visitor not found"));
        v.setCheckedOutAt(Instant.now());
        return visitorMap(visitors.save(v), userNames());
    }

    @Transactional(readOnly = true)
    public Map<String, String> getSettings(UserPrincipal caller) {
        if (!SETTINGS_READ.contains(caller.role())) {
            throw new ForbiddenException("Settings restricted");
        }
        Map<String, String> out = new LinkedHashMap<>();
        for (CompanySetting s : settings.findAllByOrderBySettingKeyAsc()) {
            if (ALLOWED_SETTINGS.contains(s.getSettingKey())) {
                out.put(s.getSettingKey(), s.getSettingValue());
            }
        }
        return out;
    }

    @Transactional
    public Map<String, String> updateSetting(UserPrincipal caller, String key, String value) {
        if (!SETTINGS.contains(caller.role())) {
            throw new ForbiddenException("Only ADMIN/CEO can change company settings");
        }
        if (!ALLOWED_SETTINGS.contains(key)) {
            throw new BadRequestException("Setting key not allowed");
        }
        // Never accept secret-looking values into company settings.
        String lower = key.toLowerCase();
        if (lower.contains("secret") || lower.contains("password") || lower.contains("token")
                || lower.contains("jwt") || lower.contains("api_key")) {
            throw new BadRequestException("Secret keys cannot be stored here");
        }
        CompanySetting row = settings.findById(key).orElseGet(() -> new CompanySetting(key, ""));
        String cleaned = XssSanitizer.text(value);
        row.setSettingValue(cleaned != null ? cleaned : "");
        row.setUpdatedBy(caller.id());
        settings.save(row);
        return getSettings(caller);
    }

    private void requireStaff(UserPrincipal caller) {
        if (caller.role() == Role.FINANCE) {
            throw new ForbiddenException("Finance portal users cannot access HR modules");
        }
    }

    private Map<UUID, String> userNames() {
        Map<UUID, String> map = new LinkedHashMap<>();
        for (User u : users.findAllByOrderByFullNameAsc()) {
            map.put(u.getId(), u.getFullName());
        }
        return map;
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private Map<String, Object> attendanceMap(AttendanceDayResponse a) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", a.id());
        m.put("userId", a.userId());
        m.put("userName", a.userName() != null ? a.userName() : "—");
        m.put("workDate", a.workDate());
        m.put("checkInAt", a.checkInAt());
        m.put("checkOutAt", a.checkOutAt());
        m.put("status", a.status());
        m.put("notes", a.notes());
        m.put("clockSkewFlagged", a.clockSkewFlagged());
        m.put("lateFlagged", a.lateFlagged());
        m.put("workedMinutes", a.workedMinutes());
        m.put("ruleVersion", a.ruleVersion());
        return m;
    }

    private Map<String, Object> leaveMap(StaffLeaveRequest l, Map<UUID, String> names) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", l.getId());
        m.put("userId", l.getUserId());
        m.put("userName", names.getOrDefault(l.getUserId(), "—"));
        m.put("leaveType", l.getLeaveType());
        m.put("fromDate", l.getFromDate());
        m.put("toDate", l.getToDate());
        m.put("reason", l.getReason());
        m.put("status", l.getStatus());
        m.put("portion", l.getPortion());
        m.put("chargeableDays", attendance.chargeableDays(l.getFromDate(), l.getToDate()));
        m.put("reviewedBy", l.getReviewedBy());
        m.put("reviewNote", l.getReviewNote());
        return m;
    }

    private Map<String, Object> payrollMap(StaffPayroll p, Map<UUID, String> names) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("userId", p.getUserId());
        m.put("userName", names.getOrDefault(p.getUserId(), "—"));
        m.put("periodMonth", p.getPeriodMonth());
        m.put("basicPay", p.getBasicPay());
        m.put("allowances", p.getAllowances());
        m.put("deductions", p.getDeductions());
        m.put("netPay", p.getNetPay());
        m.put("status", p.getStatus());
        m.put("notes", p.getNotes());
        return m;
    }

    private Map<String, Object> inventoryMap(InventoryItem i) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", i.getId());
        m.put("sku", i.getSku());
        m.put("name", i.getName());
        m.put("category", i.getCategory());
        m.put("quantity", i.getQuantity());
        m.put("unit", i.getUnit());
        m.put("reorderLevel", i.getReorderLevel());
        m.put("location", i.getLocation());
        m.put("lowStock", i.getQuantity().compareTo(i.getReorderLevel()) <= 0);
        m.put("notes", i.getNotes());
        return m;
    }

    private Map<String, Object> visitorMap(VisitorLog v, Map<UUID, String> names) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", v.getId());
        m.put("visitorName", v.getVisitorName());
        m.put("phone", v.getPhone());
        m.put("purpose", v.getPurpose());
        m.put("hostUserId", v.getHostUserId());
        m.put("hostName", v.getHostUserId() == null ? null : names.get(v.getHostUserId()));
        m.put("checkedInAt", v.getCheckedInAt());
        m.put("checkedOutAt", v.getCheckedOutAt());
        m.put("notes", v.getNotes());
        return m;
    }
}
