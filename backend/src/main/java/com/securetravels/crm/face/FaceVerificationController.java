package com.securetravels.crm.face;

import com.securetravels.crm.common.security.CurrentUser;
import com.securetravels.crm.face.dto.FaceEnrollRequest;
import com.securetravels.crm.face.dto.FaceRosterItemResponse;
import com.securetravels.crm.face.dto.FaceVerificationLogResponse;
import com.securetravels.crm.face.dto.FaceVerifyRequest;
import com.securetravels.crm.face.dto.FaceVerifyResponse;
import com.securetravels.crm.user.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/face")
@PreAuthorize("hasAnyRole('MANAGER','ADMIN','CEO')")
public class FaceVerificationController {

    private final FaceVerificationService faces;

    public FaceVerificationController(FaceVerificationService faces) {
        this.faces = faces;
    }

    @Operation(summary = "Office face roster (enrolled or not)", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/roster")
    public List<FaceRosterItemResponse> roster(@CurrentUser UserPrincipal principal) {
        return faces.roster(principal);
    }

    @Operation(summary = "Enroll or replace a person's webcam face template",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/enroll")
    public FaceRosterItemResponse enroll(@CurrentUser UserPrincipal principal,
                                         @Valid @RequestBody FaceEnrollRequest request) {
        return faces.enroll(principal, request);
    }

    @Operation(summary = "Clear active face enrollment", security = @SecurityRequirement(name = "bearerAuth"))
    @DeleteMapping("/enroll/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void clear(@CurrentUser UserPrincipal principal, @PathVariable UUID userId) {
        faces.clearEnrollment(principal, userId);
    }

    @Operation(summary = "Verify a webcam face (1:1 or identify)",
            security = @SecurityRequirement(name = "bearerAuth"))
    @PostMapping("/verify")
    public FaceVerifyResponse verify(@CurrentUser UserPrincipal principal,
                                     @Valid @RequestBody FaceVerifyRequest request) {
        return faces.verify(principal, request);
    }

    @Operation(summary = "Verification attempts for one India day",
            security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/log")
    public List<FaceVerificationLogResponse> log(
            @CurrentUser UserPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate day) {
        return faces.recentLog(principal, day);
    }
}
