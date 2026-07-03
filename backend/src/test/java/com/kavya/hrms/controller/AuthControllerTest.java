package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.Collections;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

import com.kavya.hrms.dto.ChangePasswordRequest;
import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.dto.PasswordResetConfirmationRequest;
import com.kavya.hrms.dto.PasswordResetRequest;
import com.kavya.hrms.dto.PasswordResetResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AuthSessionRepository;
import com.kavya.hrms.service.PasswordResetEmailService;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("all")
class AuthControllerTest {
    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private PasswordResetEmailService passwordResetEmailService;

    @Mock
    private AuthSessionRepository authSessionRepository;

    @InjectMocks
    private AuthController authController;

    @Test
    void loginShouldAcceptPlainPasswordAndReturnSuccess() {
        AppUser user = new AppUser();
        user.setEmail("Admin@Example.com");
        user.setPassword("admin123");
        user.setRole("admin");
        user.setEmployeeId("ADMIN-001");
        user.setEmployeeName("Admin Kavya");
        user.setUserId("USR-ADMIN-001");
        user.setStatus("Active");

        when(appUserRepository.findAllByEmailIgnoreCase("admin@example.com"))
            .thenReturn(Collections.singletonList(user));
        when(authSessionRepository.save(any(AuthSession.class))).thenAnswer(invocation -> invocation.getArgument(0));
        LoginRequest request = new LoginRequest();
        request.setEmail("Admin@Example.com");
        request.setPassword("admin123");

        ResponseEntity<LoginResponse> response = authController.login(request);
        assertNotNull(response, "Response should not be null");

        assertEquals(200, response.getStatusCode().value());
        LoginResponse body = java.util.Objects.requireNonNull(response.getBody(), "Response body should not be null");
        assertTrue(body.isOk());
        assertEquals("Super Admin", body.getRole());
    }

    @Test
    void forgotPasswordShouldSendEmailAndNotExposeTokenWhenMailIsConfigured() {
        AppUser user = new AppUser();
        user.setEmail("employee@example.com");
        user.setPassword("employee123");
        user.setRole("employee");
        user.setEmployeeId("KV001");
        user.setEmployeeName("Aarav Sharma");
        user.setUserId("USR-KV001");
        user.setStatus("Active");

        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com"))
            .thenReturn(Collections.singletonList(user));
        when(passwordResetEmailService.sendResetCode(any(AppUser.class), any(String.class), any(String.class)))
            .thenReturn(PasswordResetEmailService.DeliveryResult.sent());

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("employee@example.com");

        ResponseEntity<PasswordResetResponse> response = authController.forgotPassword(request);
        PasswordResetResponse body = java.util.Objects.requireNonNull(response.getBody(), "Response body should not be null");

        assertEquals(200, response.getStatusCode().value());
        assertTrue(body.isOk());
        assertTrue(body.isEmailSent());
        assertEquals("", body.getResetToken());
        assertNotNull(body.getExpiresAt());
    }

    @Test
    void forgotPasswordShouldExposeTokenOnlyWhenMailIsNotConfigured() {
        AppUser user = new AppUser();
        user.setEmail("employee@example.com");
        user.setPassword("employee123");
        user.setRole("employee");
        user.setEmployeeId("KV001");
        user.setEmployeeName("Aarav Sharma");
        user.setUserId("USR-KV001");
        user.setStatus("Active");

        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com"))
            .thenReturn(Collections.singletonList(user));
        when(passwordResetEmailService.sendResetCode(any(AppUser.class), any(String.class), any(String.class)))
            .thenReturn(PasswordResetEmailService.DeliveryResult.notConfigured());

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("employee@example.com");

        ResponseEntity<PasswordResetResponse> response = authController.forgotPassword(request);
        PasswordResetResponse body = java.util.Objects.requireNonNull(response.getBody(), "Response body should not be null");

        assertEquals(200, response.getStatusCode().value());
        assertTrue(body.isOk());
        assertTrue(!body.isEmailSent());
        assertNotNull(body.getResetToken());
        assertEquals(6, body.getResetToken().length());
    }

    @Test
    void resetPasswordShouldUpdateStoredPassword() {
        AppUser user = new AppUser();
        user.setEmail("employee@example.com");
        user.setPassword("employee123");
        user.setPasswordHash("");
        user.setRole("employee");
        user.setEmployeeId("KV001");
        user.setEmployeeName("Aarav Sharma");
        user.setUserId("USR-KV001");
        user.setStatus("Active");
        user.setMustChangePassword(true);
        user.setPasswordResetToken("123456");
        user.setPasswordResetTokenExpiresAt(Instant.now().plusSeconds(600).toString());

        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com"))
            .thenReturn(Collections.singletonList(user));

        PasswordResetConfirmationRequest request = new PasswordResetConfirmationRequest();
        request.setEmail("employee@example.com");
        request.setToken("123456");
        request.setNewPassword("newPass123");

        ResponseEntity<PasswordResetResponse> response = authController.resetPassword(request);
        PasswordResetResponse body = java.util.Objects.requireNonNull(response.getBody(), "Response body should not be null");

        assertEquals(200, response.getStatusCode().value());
        assertTrue(body.isOk());
        assertEquals("newPass123", user.getPassword());
        assertTrue(user.getPasswordHash() != null && !user.getPasswordHash().isBlank());
        assertTrue(!Boolean.TRUE.equals(user.getMustChangePassword()));
        assertNull(user.getPasswordResetToken());
        assertNull(user.getPasswordResetTokenExpiresAt());
    }

    @Test
    void changePasswordShouldRequireMatchingCurrentPasswordAndClearMustChangePassword() {
        AppUser user = new AppUser();
        user.setEmail("employee@example.com");
        user.setPassword("Temp@123");
        user.setRole("employee");
        user.setEmployeeId("KV001");
        user.setEmployeeName("Aarav Sharma");
        user.setUserId("USR-KV001");
        user.setStatus("Active");
        user.setMustChangePassword(true);

        AuthSession session = new AuthSession();
        session.setToken("token-123");
        session.setEmail("employee@example.com");
        session.setRole("Employee");
        session.setEmployeeId("KV001");
        session.setEmployeeName("Aarav Sharma");
        session.setStatus("Active");
        session.setMustChangePassword(true);

        when(authSessionRepository.findById("token-123")).thenReturn(Optional.of(session));
        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com"))
            .thenReturn(Collections.singletonList(user));
        when(authSessionRepository.save(any(AuthSession.class))).thenAnswer(invocation -> invocation.getArgument(0));

        ChangePasswordRequest request = new ChangePasswordRequest();
        request.setCurrentPassword("Temp@123");
        request.setNewPassword("NewPass@123");
        request.setConfirmPassword("NewPass@123");

        ResponseEntity<LoginResponse> response = authController.changePassword("Bearer token-123", request);
        LoginResponse body = java.util.Objects.requireNonNull(response.getBody(), "Response body should not be null");

        assertEquals(200, response.getStatusCode().value());
        assertTrue(body.isOk());
        assertTrue(!body.isMustChangePassword());
        assertEquals("NewPass@123", user.getPassword());
        assertTrue(user.getPasswordHash() != null && !user.getPasswordHash().isBlank());
        assertTrue(!Boolean.TRUE.equals(user.getMustChangePassword()));
        assertTrue(!Boolean.TRUE.equals(session.getMustChangePassword()));
    }
}