package com.kavya.hrms.dto;

public class LoginResponse {
  private boolean ok;
  private String role;
  private String email;
  private String employeeId;
  private String employeeName;
  private String avatar;
  private String profilePicture;
  private String userId;
  private String status;
  private String lastLogin;
  private String token;
  private boolean mustChangePassword;
  private String message;

  public boolean isOk() { return ok; }
  public void setOk(boolean ok) { this.ok = ok; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getAvatar() { return avatar; }
  public void setAvatar(String avatar) { this.avatar = avatar; }
  public String getProfilePicture() { return profilePicture; }
  public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getLastLogin() { return lastLogin; }
  public void setLastLogin(String lastLogin) { this.lastLogin = lastLogin; }
  public String getToken() { return token; }
  public void setToken(String token) { this.token = token; }
  public boolean isMustChangePassword() { return mustChangePassword; }
  public void setMustChangePassword(boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
}