package com.securetravels.crm.attendance;

import com.securetravels.crm.BaseIT;
import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;
import com.securetravels.crm.user.UserPrincipal;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.atomic.AtomicReference;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AttendanceFlowIT extends BaseIT {

    @Autowired AttendanceService attendanceService;
    @Autowired AttendanceCloseJob closeJob;

    @Test
    void secondCheckInDoesNotReplaceTheFirstAndTheDayIsKolkata() throws Exception {
        createUser("punch@toh.test", "Punch Sales", Role.SALES, "password1");
        String token = login("punch@toh.test", "password1");
        String skewedDevice = Instant.now().minusSeconds(3600).toString();

        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("""
                                {"type":"CHECK_IN","deviceTime":"%s"}
                                """.formatted(skewedDevice)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.workDate").value(LocalDate.now(ZoneId.of("Asia/Kolkata")).toString()))
                .andExpect(jsonPath("$.clockSkewFlagged").value(true))
                .andExpect(jsonPath("$.checkInAt").isNotEmpty());

        String checkInAt = objectMapper.readTree(mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get(0).get("checkInAt").asText();

        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("{\"type\":\"CHECK_IN\",\"deviceTime\":\"" + Instant.now() + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkInAt").value(checkInAt));

        mockMvc.perform(get("/api/attendance/events")
                        .header("Authorization", authHeader(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
    }

    @Test
    void repeatingAClientEventIdDoesNotCreateASecondPunch() throws Exception {
        createUser("idem@toh.test", "Idem Sales", Role.SALES, "password1");
        String token = login("idem@toh.test", "password1");
        String clientEventId = UUID.randomUUID().toString();
        String body = """
                {"type":"CHECK_IN","clientEventId":"%s","deviceTime":"%s"}
                """.formatted(clientEventId, Instant.now());

        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content(body))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/attendance/events")
                        .header("Authorization", authHeader(token)))
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void salesCannotPunchSomeoneElseAndAManagerSeesOnlyDirectReports() throws Exception {
        UUID managerId = createUser("mgr@toh.test", "Line Manager", Role.MANAGER, "password1");
        UUID reportId = createUser("report@toh.test", "Direct Report", Role.SALES, "password1");
        UUID strangerId = createUser("stranger@toh.test", "Other Sales", Role.SALES, "password1");
        createUser("admin@toh.test", "Admin", Role.ADMIN, "password1");
        createUser("finance@toh.test", "Finance", Role.FINANCE, "password1");

        User report = userRepository.findById(reportId).orElseThrow();
        report.setReportsTo(managerId);
        userRepository.save(report);

        String reportToken = login("report@toh.test", "password1");
        String strangerToken = login("stranger@toh.test", "password1");
        String managerToken = login("mgr@toh.test", "password1");
        String adminToken = login("admin@toh.test", "password1");
        String financeToken = login("finance@toh.test", "password1");

        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(reportToken))
                        .contentType("application/json")
                        .content("{\"type\":\"CHECK_IN\",\"userId\":\"" + strangerId + "\",\"deviceTime\":\"" + Instant.now() + "\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(reportToken))
                        .contentType("application/json")
                        .content("{\"type\":\"CHECK_IN\",\"deviceTime\":\"" + Instant.now() + "\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(strangerToken))
                        .contentType("application/json")
                        .content("{\"type\":\"CHECK_IN\",\"deviceTime\":\"" + Instant.now() + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(managerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userId").value(reportId.toString()));

        mockMvc.perform(get("/api/attendance/events")
                        .param("userId", strangerId.toString())
                        .header("Authorization", authHeader(managerToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(financeToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void checkoutKeepsTheFirstCheckInAndLeaveStillOpens() throws Exception {
        createUser("day@toh.test", "Day Sales", Role.SALES, "password1");
        String token = login("day@toh.test", "password1");

        mockMvc.perform(post("/api/basecamp/attendance")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("{\"checkIn\":true,\"status\":\"PRESENT\",\"workDate\":\"2020-01-01\"}"))
                .andExpect(status().isOk());
        String checkInAt = objectMapper.readTree(mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(token)))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString()).get(0).get("checkInAt").asText();

        mockMvc.perform(post("/api/basecamp/attendance")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("{\"checkOut\":true,\"workDate\":\"2020-01-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.checkInAt").value(checkInAt))
                .andExpect(jsonPath("$.checkOutAt").isNotEmpty())
                .andExpect(jsonPath("$.workDate").value(LocalDate.now(ZoneId.of("Asia/Kolkata")).toString()));

        mockMvc.perform(post("/api/basecamp/leave")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("""
                                {"leaveType":"CASUAL","fromDate":"2026-11-02","toDate":"2026-11-03","reason":"Family visit"}
                                """))
                .andExpect(status().isCreated());
    }

    @Test
    void onlyAdminCanAssignTheLineManager() throws Exception {
        UUID managerId = createUser("boss@toh.test", "Boss", Role.MANAGER, "password1");
        UUID salesId = createUser("staff@toh.test", "Staff", Role.SALES, "password1");
        createUser("chief@toh.test", "Chief", Role.ADMIN, "password1");
        String managerToken = login("boss@toh.test", "password1");
        String adminToken = login("chief@toh.test", "password1");

        mockMvc.perform(put("/api/attendance/team/" + salesId + "/reports-to")
                        .header("Authorization", authHeader(managerToken))
                        .contentType("application/json")
                        .content("{\"reportsTo\":\"" + managerId + "\"}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/attendance/team/" + salesId + "/reports-to")
                        .header("Authorization", authHeader(adminToken))
                        .contentType("application/json")
                        .content("{\"reportsTo\":\"" + managerId + "\"}"))
                .andExpect(status().isNoContent());

        User saved = userRepository.findById(salesId).orElseThrow();
        org.junit.jupiter.api.Assertions.assertEquals(managerId, saved.getReportsTo());
    }

    @Test
    void anEmployeeCannotReadAnotherEmployeeAndAManagerCannotSeeAnotherTeam() throws Exception {
        UUID managerA = createUser("mgr-a@toh.test", "Manager A", Role.MANAGER, "password1");
        UUID managerB = createUser("mgr-b@toh.test", "Manager B", Role.MANAGER, "password1");
        UUID reportA = createUser("rep-a@toh.test", "Report A", Role.SALES, "password1");
        UUID reportB = createUser("rep-b@toh.test", "Report B", Role.SALES, "password1");
        User a = userRepository.findById(reportA).orElseThrow();
        a.setReportsTo(managerA);
        userRepository.save(a);
        User b = userRepository.findById(reportB).orElseThrow();
        b.setReportsTo(managerB);
        userRepository.save(b);

        String tokenA = login("rep-a@toh.test", "password1");
        String tokenB = login("rep-b@toh.test", "password1");
        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(tokenA))
                        .contentType("application/json")
                        .content("{\"type\":\"CHECK_IN\",\"deviceTime\":\"" + Instant.now() + "\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(tokenB))
                        .contentType("application/json")
                        .content("{\"type\":\"CHECK_IN\",\"deviceTime\":\"" + Instant.now() + "\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/attendance/events").param("userId", reportB.toString())
                        .header("Authorization", authHeader(tokenA)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(tokenA)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userId").value(reportA.toString()));

        String managerToken = login("mgr-a@toh.test", "password1");
        mockMvc.perform(get("/api/attendance/events").param("userId", reportB.toString())
                        .header("Authorization", authHeader(managerToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(managerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].userId").value(reportA.toString()));
    }

    @Test
    void reportsToRejectsAnInactiveManagerAndACycle() throws Exception {
        UUID admin = createUser("cycle-admin@toh.test", "Admin", Role.ADMIN, "password1");
        UUID first = createUser("cycle-a@toh.test", "A", Role.MANAGER, "password1");
        UUID second = createUser("cycle-b@toh.test", "B", Role.MANAGER, "password1");
        UUID third = createUser("cycle-c@toh.test", "C", Role.MANAGER, "password1");
        UUID inactive = createUser("cycle-off@toh.test", "Off", Role.MANAGER, "password1");
        User off = userRepository.findById(inactive).orElseThrow();
        off.setActive(false);
        userRepository.save(off);
        String token = login("cycle-admin@toh.test", "password1");

        mockMvc.perform(put("/api/attendance/team/" + third + "/reports-to")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("{\"reportsTo\":\"" + inactive + "\"}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(put("/api/attendance/team/reports-to")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("""
                                {"assignments":[
                                  {"userId":"%s","reportsTo":"%s"},
                                  {"userId":"%s","reportsTo":"%s"}
                                ]}
                                """.formatted(second, first, third, second)))
                .andExpect(status().isNoContent());

        mockMvc.perform(put("/api/attendance/team/" + first + "/reports-to")
                        .header("Authorization", authHeader(token))
                        .contentType("application/json")
                        .content("{\"reportsTo\":\"" + third + "\"}"))
                .andExpect(status().isBadRequest());
        org.junit.jupiter.api.Assertions.assertNotEquals(admin, first);
    }

    @Test
    void twoSimultaneousPunchesProduceOneSummary() throws Exception {
        UUID salesId = createUser("race@toh.test", "Race", Role.SALES, "password1");
        UserPrincipal caller = new UserPrincipal(salesId, "race@toh.test", "Race", Role.SALES, true);
        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch done = new CountDownLatch(2);
        AtomicReference<Throwable> failure = new AtomicReference<>();
        for (AttendanceEventType type : AttendanceEventType.values()) {
            new Thread(() -> {
                try {
                    start.await();
                    attendanceService.punch(caller, new com.securetravels.crm.attendance.dto.PunchRequest(
                            null, type, Instant.now(), UUID.randomUUID(), null));
                } catch (Throwable ex) {
                    failure.set(ex);
                } finally {
                    done.countDown();
                }
            }).start();
        }
        start.countDown();
        org.junit.jupiter.api.Assertions.assertTrue(done.await(30, java.util.concurrent.TimeUnit.SECONDS));
        org.junit.jupiter.api.Assertions.assertNull(failure.get());
        mockMvc.perform(get("/api/attendance/events")
                        .header("Authorization", authHeader(login("race@toh.test", "password1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));
        mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(login("race@toh.test", "password1"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].checkInAt").isNotEmpty())
                .andExpect(jsonPath("$[0].checkOutAt").isNotEmpty());
    }

    @Test
    void leaveCancelAndAFutureRuleLeaveTodayOnTheOldVersion() throws Exception {
        createUser("leave-staff@toh.test", "Leave Staff", Role.SALES, "password1");
        createUser("leave-boss@toh.test", "Leave Boss", Role.MANAGER, "password1");
        createUser("leave-admin@toh.test", "Leave Admin", Role.ADMIN, "password1");
        String staff = login("leave-staff@toh.test", "password1");
        String boss = login("leave-boss@toh.test", "password1");
        String admin = login("leave-admin@toh.test", "password1");

        String created = mockMvc.perform(post("/api/basecamp/leave")
                        .header("Authorization", authHeader(staff))
                        .contentType("application/json")
                        .content("""
                                {"leaveType":"CASUAL","fromDate":"2026-10-25","toDate":"2026-10-26","reason":"Span"}
                                """))
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String leaveId = objectMapper.readTree(created).get("id").asText();

        mockMvc.perform(post("/api/basecamp/leave/" + leaveId + "/review")
                        .header("Authorization", authHeader(boss))
                        .contentType("application/json")
                        .content("{\"status\":\"APPROVED\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.chargeableDays").value(1));

        mockMvc.perform(get("/api/attendance/days")
                        .param("from", "2026-10-26").param("to", "2026-10-26")
                        .header("Authorization", authHeader(staff)))
                .andExpect(jsonPath("$[0].status").value("ON_LEAVE"));

        mockMvc.perform(post("/api/basecamp/leave/" + leaveId + "/cancel")
                        .header("Authorization", authHeader(boss)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/attendance/days")
                        .param("from", "2026-10-26").param("to", "2026-10-26")
                        .header("Authorization", authHeader(staff)))
                .andExpect(jsonPath("$[0].status").value("ABSENT"));

        mockMvc.perform(post("/api/attendance/punches")
                        .header("Authorization", authHeader(staff))
                        .contentType("application/json")
                        .content("{\"type\":\"CHECK_IN\",\"deviceTime\":\"" + Instant.now() + "\"}"))
                .andExpect(jsonPath("$.ruleVersion").value(1));
        mockMvc.perform(post("/api/attendance/rules")
                        .header("Authorization", authHeader(admin))
                        .contentType("application/json")
                        .content("""
                                {"effectiveFrom":"2099-01-01","graceMinutes":10,"halfDayMinutes":200,
                                 "fullDayMinutes":400,"lateMarksToHalfDay":2,"overtimeAfterMinutes":500}
                                """))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/attendance/days")
                        .header("Authorization", authHeader(staff)))
                .andExpect(jsonPath("$[?(@.ruleVersion == 1)]").exists());
    }

    @Test
    void nightlyCloseIsIdempotentAndSkipsALockedMonth() {
        createUser("close@toh.test", "Close", Role.SALES, "password1");
        Instant mondayMorning = LocalDateTime.parse("2026-10-26T00:30")
                .atZone(ZoneId.of("Asia/Kolkata")).toInstant();
        int first = closeJob.closeFinishedDays(mondayMorning);
        int second = closeJob.closeFinishedDays(mondayMorning);
        org.junit.jupiter.api.Assertions.assertTrue(first > 0);
        org.junit.jupiter.api.Assertions.assertEquals(0, second);
        String sunday = jdbcTemplate.queryForObject("""
                SELECT status FROM staff_attendance a
                  JOIN users u ON u.id = a.user_id
                 WHERE u.email = 'close@toh.test' AND a.work_date = '2026-10-25'
                """, String.class);
        String saturday = jdbcTemplate.queryForObject("""
                SELECT status FROM staff_attendance a
                  JOIN users u ON u.id = a.user_id
                 WHERE u.email = 'close@toh.test' AND a.work_date = '2026-10-24'
                """, String.class);
        org.junit.jupiter.api.Assertions.assertEquals("WEEKLY_OFF", sunday);
        org.junit.jupiter.api.Assertions.assertEquals("ABSENT", saturday);

        jdbcTemplate.update("INSERT INTO attendance_period_locks (period_month) VALUES ('2026-10')");
        int locked = closeJob.closeFinishedDays(mondayMorning);
        org.junit.jupiter.api.Assertions.assertEquals(0, locked);
    }
}
