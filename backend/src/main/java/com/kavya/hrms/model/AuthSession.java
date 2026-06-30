package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "auth_sessions")
public class AuthSession {
  @Id
  private String token;
  private String userId;
  private String email;
  private String role;
  private String employeeId;
  private String employeeName;
  private String status;
  private String lastLogin;
  private String createdAt;
  private String lastSeenAt;
  private Boolean mustChangePassword;
public String getToken() { return token; }
  public void setToken(String token) { this.token = token; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getLastLogin() { return lastLogin; }
  public void setLastLogin(String lastLogin) { this.lastLogin = lastLogin; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
  public String getLastSeenAt() { return lastSeenAt; }
  public void setLastSeenAt(String lastSeenAt) { this.lastSeenAt = lastSeenAt; }
  public Boolean getMustChangePassword() { return mustChangePassword; }
  public void setMustChangePassword(Boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
}
