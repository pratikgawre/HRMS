package com.kavya.hrms.controller;

import com.kavya.hrms.dto.LoginRequest;
import com.kavya.hrms.dto.LoginResponse;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AppUserRepository appUserRepository;

  public AuthController(AppUserRepository appUserRepository) {
    this.appUserRepository = appUserRepository;
  }

  @PostMapping("/login")
  public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
    return appUserRepository.findByEmailIgnoreCase(request.getEmail())
      .filter(user -> user.getPassword().equals(request.getPassword()))
      .map(this::okResponse)
      .map(ResponseEntity::ok)
      .orElseGet(() -> ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(failed()));
  }

  private LoginResponse okResponse(AppUser user) {
    LoginResponse response = new LoginResponse();
    response.setOk(true);
    response.setUserId(user.getUserId());
    response.setLastLogin(user.getLastLogin());
    response.setRole(user.getRole());
    response.setEmail(user.getEmail());
    response.setEmployeeId(user.getEmployeeId());
    response.setEmployeeName(user.getEmployeeName());
    response.setMessage("Login successful");
    return response;
  }

  private LoginResponse failed() {
    LoginResponse response = new LoginResponse();
    response.setOk(false);
    response.setMessage("Invalid credentials");
    return response;
  }
}
