package com.securetravels.crm.attendance;

import com.securetravels.crm.attendance.dto.AttendanceDayResponse;
import com.securetravels.crm.attendance.dto.AttendanceEventResponse;
import com.securetravels.crm.attendance.dto.AttendanceSettingsResponse;
import com.securetravels.crm.attendance.dto.BulkReportsToRequest;
import com.securetravels.crm.attendance.dto.HolidayWriteRequest;
import com.securetravels.crm.attendance.dto.PunchRequest;
import com.securetravels.crm.attendance.dto.ReportsToRequest;
import com.securetravels.crm.attendance.dto.RuleWriteRequest;
import com.securetravels.crm.attendance.dto.ShiftAssignmentRequest;
import com.securetravels.crm.attendance.dto.ShiftWriteRequest;
import com.securetravels.crm.attendance.dto.WeeklyOffRequest;
import com.securetravels.crm.common.security.CurrentUser;
import com.securetravels.crm.user.UserPrincipal;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/attendance")
@SecurityRequirement(name = "bearerAuth")
public class AttendanceController {

    private final AttendanceService attendance;
    private final AttendanceAdminService admin;

    public AttendanceController(AttendanceService attendance, AttendanceAdminService admin) {
        this.attendance = attendance;
        this.admin = admin;
    }

    @PostMapping(value = "/punches", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('SALES','OPS','MANAGER','ADMIN','CEO')")
    public AttendanceDayResponse punch(@Valid @RequestBody PunchRequest body,
                                       @CurrentUser UserPrincipal caller) {
        return attendance.punch(caller, body);
    }

    @GetMapping(value = "/days", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('SALES','OPS','MANAGER','ADMIN','CEO')")
    public List<AttendanceDayResponse> days(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @CurrentUser UserPrincipal caller) {
        return attendance.listDays(caller, from, to);
    }

    @GetMapping(value = "/events", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('SALES','OPS','MANAGER','ADMIN','CEO')")
    public List<AttendanceEventResponse> events(
            @RequestParam(required = false) UUID userId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @CurrentUser UserPrincipal caller) {
        return attendance.listEvents(caller, userId, from, to);
    }

    @PutMapping("/team/reports-to")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public void assignReportsToBulk(@Valid @RequestBody BulkReportsToRequest body,
                                    @CurrentUser UserPrincipal caller) {
        attendance.assignReportsToBulk(caller, body.assignments());
    }

    @PutMapping("/team/{userId}/reports-to")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public void assignReportsTo(@PathVariable UUID userId,
                                @RequestBody ReportsToRequest body,
                                @CurrentUser UserPrincipal caller) {
        attendance.assignReportsTo(caller, userId, body == null ? null : body.reportsTo());
    }

    @GetMapping(value = "/settings", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public AttendanceSettingsResponse settings() {
        return admin.settings();
    }

    @PostMapping(value = "/rules", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public AttendanceSettingsResponse saveRule(@Valid @RequestBody RuleWriteRequest body) {
        return admin.saveRule(body);
    }

    @PostMapping(value = "/shifts", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public AttendanceSettingsResponse saveShift(@Valid @RequestBody ShiftWriteRequest body) {
        return admin.saveShift(body);
    }

    @PostMapping(value = "/shift-assignments", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public AttendanceSettingsResponse assignShift(@Valid @RequestBody ShiftAssignmentRequest body) {
        return admin.assignShift(body);
    }

    @PostMapping(value = "/holidays", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public AttendanceSettingsResponse saveHoliday(@Valid @RequestBody HolidayWriteRequest body) {
        return admin.saveHoliday(body);
    }

    @DeleteMapping(value = "/holidays/{id}", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public AttendanceSettingsResponse deleteHoliday(@PathVariable UUID id) {
        return admin.deleteHoliday(id);
    }

    @PutMapping(value = "/weekly-off", produces = MediaType.APPLICATION_JSON_VALUE)
    @PreAuthorize("hasAnyRole('ADMIN','CEO')")
    public AttendanceSettingsResponse saveWeeklyOff(@Valid @RequestBody WeeklyOffRequest body) {
        return admin.saveWeeklyOff(body);
    }
}
