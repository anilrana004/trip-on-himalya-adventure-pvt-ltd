package com.securetravels.crm.auth;

import com.securetravels.crm.common.config.AppProperties;
import com.securetravels.crm.common.security.CurrentUser;
import com.securetravels.crm.user.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AppProperties props;

    public AuthController(AuthService authService, AppProperties props) {
        this.authService = authService;
        this.props = props;
    }

    @Operation(summary = "Login (rate-limited: 5 attempts / IP / 15 min)")
    @PostMapping(value = "/login", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public AuthResponse login(@Valid @RequestBody LoginRequest request,
                              HttpServletRequest httpRequest,
                              HttpServletResponse httpResponse) {
        AuthResponse issued = authService.login(request.email(), request.password());
        writeRefresh(httpRequest, httpResponse, issued.refreshToken());
        return issued.withoutRefresh();
    }

    @Operation(summary = "Rotate refresh token from the HttpOnly cookie, or from a non-browser body")
    @PostMapping("/refresh")
    public AuthResponse refresh(@RequestBody(required = false) RefreshRequest request,
                                HttpServletRequest httpRequest,
                                HttpServletResponse httpResponse) {
        String raw = presented(httpRequest, request);
        AuthResponse issued = authService.refresh(raw);
        writeRefresh(httpRequest, httpResponse, issued.refreshToken());
        return issued.withoutRefresh();
    }

    @Operation(summary = "Revoke refresh token and clear the cookie")
    @PostMapping("/logout")
    public void logout(@RequestBody(required = false) RefreshRequest request,
                       HttpServletRequest httpRequest,
                       HttpServletResponse httpResponse) {
        String raw = firstNonBlank(RefreshCookie.read(httpRequest), request == null ? null : request.refreshToken());
        if (raw != null) {
            authService.logout(raw);
        }
        RefreshCookie.clear(httpResponse, secure(httpRequest), props.getCookie().getSameSite(), props.getCookie().getDomain());
    }

    @Operation(summary = "Current authenticated user", security = @SecurityRequirement(name = "bearerAuth"))
    @GetMapping("/me")
    public AuthResponse.UserInfo me(@CurrentUser UserPrincipal principal) {
        return new AuthResponse.UserInfo(principal.id(), principal.email(), principal.fullName(), principal.role());
    }

    private void writeRefresh(HttpServletRequest request, HttpServletResponse response, String token) {
        long maxAge = props.getJwt().getRefreshDays() * 24L * 60L * 60L;
        RefreshCookie.write(response, token, maxAge, secure(request),
                props.getCookie().getSameSite(), props.getCookie().getDomain());
    }

    private boolean secure(HttpServletRequest request) {
        return props.getCookie().isSecure() || request.isSecure();
    }

    private static String presented(HttpServletRequest request, RefreshRequest body) {
        String raw = firstNonBlank(RefreshCookie.read(request), body == null ? null : body.refreshToken());
        if (raw == null) {
            throw new BadCredentialsException("Invalid refresh token");
        }
        return raw;
    }

    private static String firstNonBlank(String cookie, String body) {
        if (cookie != null && !cookie.isBlank()) return cookie;
        if (body != null && !body.isBlank()) return body;
        return null;
    }
}
