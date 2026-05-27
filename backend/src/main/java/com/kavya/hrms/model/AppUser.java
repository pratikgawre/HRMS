package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "app_users")
public class AppUser {
  @Id
  private String id;
  private String userId;
  private String email;
  private String password;
  private String role;
  private String employeeId;
  private String employeeName;
  private String status;
  private String lastLogin;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getPassword() { return password; }
  public void setPassword(String password) { this.password = password; }
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
}
