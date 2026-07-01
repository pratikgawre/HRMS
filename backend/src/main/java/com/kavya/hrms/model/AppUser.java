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
  private String passwordHash;
  private Boolean twoFactorEnabled;
  private String twoFactorSecret;
  private String role;
  private Boolean isActive;
  private String employeeId;
  private String employeeName;
  private String avatar;
  private String profilePicture;
  private String status;
  private String lastLogin;
  private String passwordResetToken;
  private String passwordResetTokenExpiresAt;
  private Boolean mustChangePassword;
public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getPassword() { return password; }
  public void setPassword(String password) { this.password = password; }
  public String getPasswordHash() { return passwordHash; }
  public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
  public Boolean getTwoFactorEnabled() { return twoFactorEnabled; }
  public void setTwoFactorEnabled(Boolean twoFactorEnabled) { this.twoFactorEnabled = twoFactorEnabled; }
  public String getTwoFactorSecret() { return twoFactorSecret; }
  public void setTwoFactorSecret(String twoFactorSecret) { this.twoFactorSecret = twoFactorSecret; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public Boolean getIsActive() { return isActive; }
  public void setIsActive(Boolean isActive) { this.isActive = isActive; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getAvatar() { return avatar; }
  public void setAvatar(String avatar) { this.avatar = avatar; }
  public String getProfilePicture() { return profilePicture; }
  public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getLastLogin() { return lastLogin; }
  public void setLastLogin(String lastLogin) { this.lastLogin = lastLogin; }
  public String getPasswordResetToken() { return passwordResetToken; }
  public void setPasswordResetToken(String passwordResetToken) { this.passwordResetToken = passwordResetToken; }
  public String getPasswordResetTokenExpiresAt() { return passwordResetTokenExpiresAt; }
  public void setPasswordResetTokenExpiresAt(String passwordResetTokenExpiresAt) { this.passwordResetTokenExpiresAt = passwordResetTokenExpiresAt; }
  public Boolean getMustChangePassword() { return mustChangePassword; }
  public void setMustChangePassword(Boolean mustChangePassword) { this.mustChangePassword = mustChangePassword; }
}
