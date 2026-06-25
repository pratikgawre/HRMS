package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.when;

import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.model.AuthSession;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.AuthSessionRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("null")
class AuthControllerTest {
    @Mock
    private AppUserRepository appUserRepository;

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

        when(appUserRepository.findAllByEmailIgnoreCase("admin@example.com")).thenReturn(List.of(user));
        when(appUserRepository.save(user)).thenReturn(user);

        AuthSession authSession = new AuthSession();
        when(authSessionRepository.save(authSession)).thenReturn(authSession);

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
        assertEquals(true, loginResponse.isOk(), "Expected login response to be successful");
        assertEquals("Super Admin", loginResponse.getRole());
    }
}
