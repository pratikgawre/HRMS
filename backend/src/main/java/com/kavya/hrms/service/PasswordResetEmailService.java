package com.kavya.hrms.service;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.config.SmtpSettings;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class PasswordResetEmailService {
  private static final Logger log = LoggerFactory.getLogger(PasswordResetEmailService.class);
  private final SmtpSettings smtpSettings;

  public PasswordResetEmailService(
      ObjectProvider<JavaMailSender> mailSenderProvider,
      Environment environment) {
    this.smtpSettings = SmtpSettings.resolve(environment);
  }

  public DeliveryResult sendResetCode(AppUser user, String resetToken, String expiresAt) {
    if (!smtpSettings.isConfigured()) {
      log.warn("Password reset email skipped because SMTP host is blank.");
      return DeliveryResult.notConfigured();
    }

    String to = user == null || user.getEmail() == null ? "" : user.getEmail().trim();
    if (to.isBlank()) {
      return DeliveryResult.failed("Recipient email is missing.");
    }

    JavaMailSender mailSender = smtpSettings.createMailSender();
    log.info("Password reset email sending via SMTP {}:{} ssl={} timeout={}ms.", smtpSettings.getHost(), smtpSettings.getPort(), smtpSettings.isSslEnabled(), smtpSettings.getConnectionTimeoutMillis());

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
    return firstNonBlank(smtpSettings.getFromAddress(), smtpSettings.getUsername());
  }

  private String firstNonBlank(String... values) {
    if (values == null) {
      return "";
    }

    for (String value : values) {
      if (value != null) {
        String trimmed = value.trim();
        if (!trimmed.isEmpty()) {
          return trimmed;
        }
      }
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
