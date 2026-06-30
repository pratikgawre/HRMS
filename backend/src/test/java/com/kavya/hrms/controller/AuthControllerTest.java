package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

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
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.Answer;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("all")
class AuthControllerTest {
    @Mock
    private AppUserRepository appUserRepository;

    @Mock
    private AuthSessionRepository authSessionRepository;

    @Mock
    private PasswordResetEmailService passwordResetEmailService;

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

        when(appUserRepository.findAllByEmailIgnoreCase("admin@example.com")).thenReturn(List.of(user));
        Answer<AppUser> saveUserAnswer = invocation -> (AppUser) invocation.getArguments()[0];
        Answer<AuthSession> saveSessionAnswer = invocation -> (AuthSession) invocation.getArguments()[0];
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(saveUserAnswer);
        when(authSessionRepository.save(any(AuthSession.class))).thenAnswer(saveSessionAnswer);

        LoginRequest request = new LoginRequest();
        request.setEmail("Admin@Example.com");
        request.setPassword("admin123");

        ResponseEntity<LoginResponse> response = authController.login(request);
        assertNotNull(response, "Response should not be null");

        LoginResponse loginResponse = response.getBody();
        if (loginResponse == null) {
            throw new AssertionError("Response body should not be null");
        }

        assertEquals(200, response.getStatusCode().value());
        LoginResponse body = response.getBody();
        assertNotNull(body);
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

        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com")).thenReturn(List.of(user));
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(passwordResetEmailService.sendResetCode(any(AppUser.class), any(String.class), any(String.class)))
            .thenReturn(PasswordResetEmailService.DeliveryResult.sent());

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("employee@example.com");

        ResponseEntity<PasswordResetResponse> response = authController.forgotPassword(request);

        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody() != null && response.getBody().isOk());
        assertTrue(response.getBody().isEmailSent());
        assertEquals("", response.getBody().getResetToken());
        assertNotNull(response.getBody().getExpiresAt());
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

        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com")).thenReturn(List.of(user));
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(passwordResetEmailService.sendResetCode(any(AppUser.class), any(String.class), any(String.class)))
            .thenReturn(PasswordResetEmailService.DeliveryResult.notConfigured());

        PasswordResetRequest request = new PasswordResetRequest();
        request.setEmail("employee@example.com");

        ResponseEntity<PasswordResetResponse> response = authController.forgotPassword(request);

        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody() != null && response.getBody().isOk());
        assertTrue(!response.getBody().isEmailSent());
        assertNotNull(response.getBody().getResetToken());
        assertEquals(6, response.getBody().getResetToken().length());
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
        user.setPasswordResetToken("123456");
        user.setPasswordResetTokenExpiresAt(Instant.now().plusSeconds(600).toString());

        when(appUserRepository.findAllByEmailIgnoreCase("employee@example.com")).thenReturn(List.of(user));
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));

        PasswordResetConfirmationRequest request = new PasswordResetConfirmationRequest();
        request.setEmail("employee@example.com");
        request.setToken("123456");
        request.setNewPassword("newPass123");

        ResponseEntity<PasswordResetResponse> response = authController.resetPassword(request);

        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody() != null && response.getBody().isOk());
        assertEquals("newPass123", user.getPassword());
        assertTrue(user.getPasswordHash() != null && !user.getPasswordHash().isBlank());
        assertEquals(null, user.getPasswordResetToken());
        assertEquals(null, user.getPasswordResetTokenExpiresAt());
    }
}