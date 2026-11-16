package com.securetravels.crm.lead.dto;

import java.util.List;

/** Sales follow-up desk buckets (Asia/Kolkata day boundaries). */
public record TodayFollowUpsResponse(
        int overdueCount,
        int dueTodayCount,
        int upcomingCount,
        int completedCount,
        List<LeadResponse> overdue,
        List<LeadResponse> dueToday,
        List<LeadResponse> upcoming,
        List<LeadResponse> completed
) {
}
