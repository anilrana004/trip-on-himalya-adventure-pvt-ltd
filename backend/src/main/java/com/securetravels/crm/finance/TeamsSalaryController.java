package com.securetravels.crm.finance;

import com.securetravels.crm.basecamp.StaffPayroll;
import com.securetravels.crm.common.security.CurrentUser;
import com.securetravels.crm.finance.dto.TeamsSalaryDayResponse;
import com.securetravels.crm.finance.dto.TeamsSalaryLineResponse;
import com.securetravels.crm.finance.dto.TeamsSalaryMonthResponse;
import com.securetravels.crm.user.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Company teams salary — finance pays sales/ops/transport/etc by month;
 * employees see their own paid line + attendance hours on /me.
 */
@RestController
@RequestMapping("/api/finance/teams-salary")
@SecurityRequirement(name = "bearerAuth")
public class TeamsSalaryController {

    private final TeamsSalaryService salary;

    public TeamsSalaryController(TeamsSalaryService salary) {
        this.salary = salary;
    }

    @GetMapping(produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('FINANCE','ADMIN','CEO','MANAGER')")
    @Operation(summary = "Month salary desk for all eligible team members")
    public TeamsSalaryMonthResponse desk(@RequestParam(required = false) String month,
                                         @RequestParam(required = false) String role,
                                         @CurrentUser UserPrincipal caller) {
        return salary.monthDesk(month, role, caller);
    }

    @PostMapping(value = "/generate", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('FINANCE','ADMIN','CEO')")
    @Operation(summary = "Generate/refresh month lines from attendance for every eligible staff")
    public TeamsSalaryMonthResponse generate(@RequestParam(required = false) String month,
                                             @CurrentUser UserPrincipal caller) {
        return salary.generate(month, caller);
    }

    @PostMapping(value = "/lines", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('FINANCE','ADMIN','CEO')")
    @Operation(summary = "Create or update one person's month salary line")
    public TeamsSalaryLineResponse upsert(@RequestBody Map<String, Object> body,
                                          @CurrentUser UserPrincipal caller) {
        return salary.upsertLine(
                UUID.fromString(body.get("userId").toString()),
                body.get("periodMonth") != null ? body.get("periodMonth").toString() : null,
                num(body.get("basicPay")),
                num(body.get("allowances")),
                num(body.get("deductions")),
                body.get("status") != null ? StaffPayroll.Status.valueOf(body.get("status").toString()) : null,
                body.get("notes") != null ? body.get("notes").toString() : null,
                num(body.get("monthlySalaryDefault")),
                caller);
    }

    @PostMapping(value = "/lines/{userId}/pay", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('FINANCE','ADMIN','CEO')")
    @Operation(summary = "Mark one person's month as PAID and post SALARIES expense")
    public TeamsSalaryLineResponse pay(@PathVariable UUID userId,
                                       @RequestParam(required = false) String month,
                                       @RequestBody(required = false) Map<String, Object> body,
                                       @CurrentUser UserPrincipal caller) {
        String ref = body != null && body.get("paymentRef") != null ? body.get("paymentRef").toString() : null;
        return salary.markPaid(userId, month, ref, caller);
    }

    @PostMapping(value = "/pay-approved", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('FINANCE','ADMIN','CEO')")
    @Operation(summary = "Mark all APPROVED lines for the month as PAID")
    public TeamsSalaryMonthResponse payApproved(@RequestParam(required = false) String month,
                                                @RequestBody(required = false) Map<String, Object> body,
                                                @CurrentUser UserPrincipal caller) {
        String ref = body != null && body.get("paymentRef") != null ? body.get("paymentRef").toString() : null;
        return salary.payAllApproved(month, ref, caller);
    }

    @GetMapping(value = "/me", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "My salary line for a month (employee dashboard)")
    public TeamsSalaryLineResponse me(@RequestParam(required = false) String month,
                                      @CurrentUser UserPrincipal caller) {
        return salary.mySalary(month, caller);
    }

    @GetMapping(value = "/days", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Attendance day rows behind a salary month (self or manager/finance)")
    public List<TeamsSalaryDayResponse> days(@RequestParam(required = false) String month,
                                             @RequestParam(required = false) UUID userId,
                                             @CurrentUser UserPrincipal caller) {
        return salary.myDays(month, userId, caller);
    }

    private static BigDecimal num(Object v) {
        if (v == null) return null;
        if (v instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        String s = v.toString().trim();
        if (s.isEmpty()) return null;
        return new BigDecimal(s);
    }
}
