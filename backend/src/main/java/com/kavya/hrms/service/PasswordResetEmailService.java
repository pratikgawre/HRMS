package com.kavya.hrms.service;

import com.kavya.hrms.model.AppUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetEmailService {
  private static final Logger log = LoggerFactory.getLogger(PasswordResetEmailService.class);
  private final ObjectProvider<JavaMailSender> mailSenderProvider;
  private final String host;
  private final String fromAddress;
  private final String username;

  public PasswordResetEmailService(
      ObjectProvider<JavaMailSender> mailSenderProvider,
      @Value("${spring.mail.host:}") String host,
      @Value("${spring.mail.from:}") String fromAddress,
      @Value("${spring.mail.username:}") String username) {
    this.mailSenderProvider = mailSenderProvider;
    this.host = host == null ? "" : host.trim();
    this.fromAddress = fromAddress == null ? "" : fromAddress.trim();
    this.username = username == null ? "" : username.trim();
  }

  public DeliveryResult sendResetCode(AppUser user, String resetToken, String expiresAt) {
    if (host.isBlank()) {
      log.warn("Password reset email skipped because spring.mail.host is blank.");
      return DeliveryResult.notConfigured();
    }

    String to = user == null || user.getEmail() == null ? "" : user.getEmail().trim();
    if (to.isBlank()) {
      return DeliveryResult.failed("Recipient email is missing.");
    }

    JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
    if (mailSender == null) {
      log.warn("Password reset email skipped because JavaMailSender bean is unavailable.");
      return DeliveryResult.notConfigured();
    }

    SimpleMailMessage message = new SimpleMailMessage();
    message.setTo(to);
    String sender = resolveFromAddress();
    if (!sender.isBlank()) {
      message.setFrom(sender);
    }
    message.setSubject("Kavya HRMS password reset code");
    message.setText(buildMessage(user, resetToken, expiresAt));

    try {
      mailSender.send(message);
      log.info("Password reset email sent to {} from {}.", to, sender.isBlank() ? "<smtp-default>" : sender);
      return DeliveryResult.sent();
    } catch (MailException ex) {
      log.error("Unable to send password reset email to {} from {}.", to, sender.isBlank() ? "<smtp-default>" : sender, ex);
      return DeliveryResult.failed("Unable to send reset email: " + ex.getMessage());
    }
  }

  private String resolveFromAddress() {
    if (!fromAddress.isBlank()) {
      return fromAddress;
    }
    if (!username.isBlank()) {
      return username;
    }
    return "";
  }

  private String buildMessage(AppUser user, String resetToken, String expiresAt) {
    String name = user != null && user.getEmployeeName() != null && !user.getEmployeeName().isBlank()
        ? user.getEmployeeName().trim()
        : "there";

    return "Hello " + name + ",\n\n"
        + "Use this reset code to update your Kavya HRMS password: " + resetToken + "\n"
        + "This code expires at: " + expiresAt + "\n\n"
        + "If you did not request this change, you can ignore this email.";
  }

  public static final class DeliveryResult {
    private final boolean configured;
    private final boolean sent;
    private final String message;

    private DeliveryResult(boolean configured, boolean sent, String message) {
      this.configured = configured;
      this.sent = sent;
      this.message = message;
    }

    public static DeliveryResult notConfigured() {
      return new DeliveryResult(false, false, "Email service is not configured.");
    }

    public static DeliveryResult sent() {
      return new DeliveryResult(true, true, "Reset code sent to your email address.");
    }

    public static DeliveryResult failed(String message) {
      return new DeliveryResult(true, false, message == null || message.isBlank() ? "Unable to send reset email." : message);
    }

    public boolean isConfigured() { return configured; }
    public boolean isSent() { return sent; }
    public String getMessage() { return message; }
  }
}
