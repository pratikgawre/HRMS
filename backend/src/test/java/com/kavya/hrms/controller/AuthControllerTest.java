package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.model.AppUser;
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
        when(appUserRepository.save(any(AppUser.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(authSessionRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        LoginRequest request = new LoginRequest();
        request.setEmail("Admin@Example.com");
        request.setPassword("admin123");

        ResponseEntity<LoginResponse> response = authController.login(request);

        assertEquals(200, response.getStatusCode().value());
        assertTrue(response.getBody() != null && response.getBody().isOk());
        assertEquals("Super Admin", response.getBody().getRole());
    }
}
