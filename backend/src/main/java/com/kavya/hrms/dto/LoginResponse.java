package com.kavya.hrms.dto;

public class LoginResponse {
  private boolean ok;
  private String role;
  private String email;
  private String employeeId;
  private String employeeName;
  private String userId;
  private String lastLogin;
  private String token;
  private boolean twoFactorRequired;
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
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getLastLogin() { return lastLogin; }
  public void setLastLogin(String lastLogin) { this.lastLogin = lastLogin; }
  public String getToken() { return token; }
  public void setToken(String token) { this.token = token; }
  public boolean isTwoFactorRequired() { return twoFactorRequired; }
  public void setTwoFactorRequired(boolean twoFactorRequired) { this.twoFactorRequired = twoFactorRequired; }
  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
}
