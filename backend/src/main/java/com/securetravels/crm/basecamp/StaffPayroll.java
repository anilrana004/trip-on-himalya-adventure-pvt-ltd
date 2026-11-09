package com.securetravels.crm.basecamp;

import com.securetravels.crm.common.audit.Auditable;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "staff_payroll", uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "period_month"}))
public class StaffPayroll extends Auditable {

    public enum Status { DRAFT, APPROVED, PAID, VOID }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "period_month", nullable = false, length = 7)
    private String periodMonth;

    @Column(name = "basic_pay", nullable = false, precision = 12, scale = 2)
    private BigDecimal basicPay = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal allowances = BigDecimal.ZERO;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal deductions = BigDecimal.ZERO;

    @Column(name = "net_pay", nullable = false, precision = 12, scale = 2)
    private BigDecimal netPay = BigDecimal.ZERO;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.DRAFT;

    @Column(columnDefinition = "text")
    private String notes;

    @Column(name = "recorded_by")
    private UUID recordedBy;

    @Column(name = "role_snapshot", length = 20)
    private String roleSnapshot;

    @Column(name = "working_days", nullable = false)
    private int workingDays = 0;

    @Column(name = "present_days", nullable = false)
    private int presentDays = 0;

    @Column(name = "half_days", nullable = false)
    private int halfDays = 0;

    @Column(name = "leave_days", nullable = false)
    private int leaveDays = 0;

    @Column(name = "absent_days", nullable = false)
    private int absentDays = 0;

    @Column(name = "worked_minutes", nullable = false)
    private int workedMinutes = 0;

    @Column(name = "overtime_minutes", nullable = false)
    private int overtimeMinutes = 0;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "payment_ref", length = 80)
    private String paymentRef;

    @Column(name = "expense_id")
    private UUID expenseId;

    protected StaffPayroll() {}

    public StaffPayroll(UUID userId, String periodMonth) {
        this.userId = userId;
        this.periodMonth = periodMonth;
    }

    public void recalculate() {
        this.netPay = basicPay.add(allowances).subtract(deductions);
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getPeriodMonth() { return periodMonth; }
    public BigDecimal getBasicPay() { return basicPay; }
    public BigDecimal getAllowances() { return allowances; }
    public BigDecimal getDeductions() { return deductions; }
    public BigDecimal getNetPay() { return netPay; }
    public Status getStatus() { return status; }
    public String getNotes() { return notes; }
    public UUID getRecordedBy() { return recordedBy; }
    public String getRoleSnapshot() { return roleSnapshot; }
    public int getWorkingDays() { return workingDays; }
    public int getPresentDays() { return presentDays; }
    public int getHalfDays() { return halfDays; }
    public int getLeaveDays() { return leaveDays; }
    public int getAbsentDays() { return absentDays; }
    public int getWorkedMinutes() { return workedMinutes; }
    public int getOvertimeMinutes() { return overtimeMinutes; }
    public Instant getPaidAt() { return paidAt; }
    public String getPaymentRef() { return paymentRef; }
    public UUID getExpenseId() { return expenseId; }

    public void setBasicPay(BigDecimal basicPay) { this.basicPay = basicPay; }
    public void setAllowances(BigDecimal allowances) { this.allowances = allowances; }
    public void setDeductions(BigDecimal deductions) { this.deductions = deductions; }
    public void setStatus(Status status) { this.status = status; }
    public void setNotes(String notes) { this.notes = notes; }
    public void setRecordedBy(UUID recordedBy) { this.recordedBy = recordedBy; }
    public void setRoleSnapshot(String roleSnapshot) { this.roleSnapshot = roleSnapshot; }
    public void setWorkingDays(int workingDays) { this.workingDays = Math.max(0, workingDays); }
    public void setPresentDays(int presentDays) { this.presentDays = Math.max(0, presentDays); }
    public void setHalfDays(int halfDays) { this.halfDays = Math.max(0, halfDays); }
    public void setLeaveDays(int leaveDays) { this.leaveDays = Math.max(0, leaveDays); }
    public void setAbsentDays(int absentDays) { this.absentDays = Math.max(0, absentDays); }
    public void setWorkedMinutes(int workedMinutes) { this.workedMinutes = Math.max(0, workedMinutes); }
    public void setOvertimeMinutes(int overtimeMinutes) { this.overtimeMinutes = Math.max(0, overtimeMinutes); }
    public void setPaidAt(Instant paidAt) { this.paidAt = paidAt; }
    public void setPaymentRef(String paymentRef) { this.paymentRef = paymentRef; }
    public void setExpenseId(UUID expenseId) { this.expenseId = expenseId; }
}
