package com.kavya.hrms.dto;

public class PasswordResetResponse {
  private boolean ok;
  private boolean emailSent;
  private String email;
  private String resetToken;
  private String expiresAt;
  private String message;

  public boolean isOk() { return ok; }
  public void setOk(boolean ok) { this.ok = ok; }
  public boolean isEmailSent() { return emailSent; }
  public void setEmailSent(boolean emailSent) { this.emailSent = emailSent; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getResetToken() { return resetToken; }
  public void setResetToken(String resetToken) { this.resetToken = resetToken; }
  public String getExpiresAt() { return expiresAt; }
  public void setExpiresAt(String expiresAt) { this.expiresAt = expiresAt; }
  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
}