package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import java.time.Instant;
import org.springframework.http.ResponseEntity;

import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.dto.PasswordResetConfirmationRequest;
import com.kavya.hrms.dto.PasswordResetRequest;
import com.kavya.hrms.dto.PasswordResetResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.service.PasswordResetEmailService;

@org.junit.jupiter.api.extension.ExtendWith(org.mockito.junit.jupiter.MockitoExtension.class)
class AuthControllerTest {
    @org.mockito.Mock
    private AppUserRepository appUserRepository;

    @org.mockito.Mock
    private PasswordResetEmailService passwordResetEmailService;

    @org.mockito.InjectMocks
    private AuthController authController;

    @org.junit.jupiter.api.Test
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
            .thenReturn(java.util.Collections.singletonList(user));
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

    @org.junit.jupiter.api.Test
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
            .thenReturn(java.util.Collections.singletonList(user));
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

    @org.junit.jupiter.api.Test
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
            .thenReturn(java.util.Collections.singletonList(user));
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

    @org.junit.jupiter.api.Test
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
        user.setPasswordResetToken("123456");
        user.setPasswordResetTokenExpiresAt(Instant.now().plusSeconds(600).toString());

        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com"))
            .thenReturn(java.util.Collections.singletonList(user));

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
        assertNull(user.getPasswordResetToken());
        assertNull(user.getPasswordResetTokenExpiresAt());
    }
}
