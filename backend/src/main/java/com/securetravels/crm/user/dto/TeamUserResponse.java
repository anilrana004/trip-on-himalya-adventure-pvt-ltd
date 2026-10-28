package com.securetravels.crm.user.dto;

import com.securetravels.crm.user.Role;
import com.securetravels.crm.user.User;

import java.time.Instant;
import java.util.UUID;

public record TeamUserResponse(
        UUID id,
        String email,
        String fullName,
        Role role,
        String phone,
        boolean active,
        Instant createdAt,
        UUID vendorId,
        String vendorName,
        String vendorCategory
) {
    public static TeamUserResponse from(User user, String vendorName, String vendorCategory) {
        return new TeamUserResponse(
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getPhone(),
                user.isActive(),
                user.getCreatedAt(),
                user.getVendorId(),
                vendorName,
                vendorCategory);
    }
}
