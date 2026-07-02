package com.kavya.hrms.service;

import com.kavya.hrms.model.Employee;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

@Service
@SuppressWarnings("all")
public class EmployeeWelcomeEmailService {
  private static final Logger log = LoggerFactory.getLogger(EmployeeWelcomeEmailService.class);
  private final ObjectProvider<JavaMailSender> mailSenderProvider;
  private final String host;
  private final String fromAddress;
  private final String username;

  public EmployeeWelcomeEmailService(
      ObjectProvider<JavaMailSender> mailSenderProvider,
      @Value("${spring.mail.host:}") String host,
      @Value("${spring.mail.username:}") String username) {
    this.mailSenderProvider = mailSenderProvider;
    this.host = host == null ? "" : host.trim();
    this.username = username == null ? "" : username.trim();
    this.fromAddress = this.username;
  }

  public DeliveryResult sendWelcomeEmail(Employee employee) {
    return sendCredentialEmail(
        employee,
        "Welcome to Kavya HRMS",
        buildPlainTextMessage(employee, false),
        buildHtmlMessage(employee, false),
        "Welcome email",
        "Welcome email sent.");
  }

  public DeliveryResult sendCredentialUpdateEmail(Employee employee) {
    return sendCredentialEmail(
        employee,
        "Kavya HRMS login credentials updated",
        buildPlainTextMessage(employee, true),
        buildHtmlMessage(employee, true),
        "Credential update email",
        "Credential update email sent.");
  }

  private DeliveryResult sendCredentialEmail(
      Employee employee,
      String subject,
      String plainTextMessage,
      String htmlMessage,
      String emailType,
      String successMessage) {
    if (host.isBlank()) {
      log.warn("{} skipped because spring.mail.host is blank.", emailType);
      return DeliveryResult.notConfigured();
    }

    String to = employee == null || employee.getEmail() == null ? "" : employee.getEmail().trim();
    if (to.isBlank()) {
      return DeliveryResult.failed("Employee email is missing.");
    }

    JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
    if (mailSender == null) {
      log.warn("{} skipped because JavaMailSender bean is unavailable.", emailType);
      return DeliveryResult.notConfigured();
    }

    try {
      MimeMessage mimeMessage = mailSender.createMimeMessage();
      MimeMessageHelper message = new MimeMessageHelper(mimeMessage, true, "UTF-8");
      message.setTo(to);
      message.setFrom(resolveFromAddress());
      message.setSubject(subject);
      message.setText(plainTextMessage, htmlMessage);

      mailSender.send(mimeMessage);
      log.info("{} sent to {} from {}.", emailType, to, resolveFromAddress());
      return DeliveryResult.sent(successMessage);
    } catch (MailException | MessagingException ex) {
      log.error("Unable to send {} to {} from {}.", emailType, to, resolveFromAddress(), ex);
      return DeliveryResult.failed("Unable to send employee credential email: " + ex.getMessage());
    }
  }

  private String resolveFromAddress() {
    if (!fromAddress.isBlank()) {
      return fromAddress;
    }
    if (!username.isBlank()) {
      return username;
    }
    return "no-reply@kavyainfoweb.com";
  }

  private String buildPlainTextMessage(Employee employee, boolean credentialsUpdated) {
    String name = firstNonBlank(
        employee == null ? null : employee.getDisplayName(),
        employee == null ? null : employee.getName(),
        employee == null ? null : employee.getFirstName(),
        "there");
    String loginEmail = buildLoginEmail(employee);
    String department = firstNonBlank(employee == null ? null : employee.getDepartment(), "your department");
    String jobTitle = firstNonBlank(employee == null ? null : employee.getJobTitle(), "your role");
    String employeeCode = firstNonBlank(employee == null ? null : employee.getEmployeeCode(), "not assigned yet");
    String temporaryPassword = buildTemporaryPassword(employee);
    String intro = credentialsUpdated
        ? "Your employee profile has been updated in Kavya HRMS. Your login credentials have been refreshed."
        : "Welcome to Kavya HRMS. Your employee profile has been created successfully.";

    return "Hello " + name + ",\n\n"
        + intro + "\n\n"
        + "Login Email: " + loginEmail + "\n"
        + "Temporary Password: " + temporaryPassword + "\n"
        + "Employee Code: " + employeeCode + "\n"
        + "Department: " + department + "\n"
        + "Designation: " + jobTitle + "\n\n"
        + "Please sign in with the login email above and change your password after the first login.\n\n"
        + "If you have any questions, please contact the HR team.\n\n"
        + "Regards,\n"
        + "Kavya HRMS";
  }

  private String buildHtmlMessage(Employee employee, boolean credentialsUpdated) {
    String name = escapeHtml(firstNonBlank(
        employee == null ? null : employee.getDisplayName(),
        employee == null ? null : employee.getName(),
        employee == null ? null : employee.getFirstName(),
        "there"));
    String loginEmail = escapeHtml(buildLoginEmail(employee));
    String department = escapeHtml(firstNonBlank(employee == null ? null : employee.getDepartment(), "your department"));
    String jobTitle = escapeHtml(firstNonBlank(employee == null ? null : employee.getJobTitle(), "your role"));
    String employeeCode = escapeHtml(firstNonBlank(employee == null ? null : employee.getEmployeeCode(), "not assigned yet"));
    String temporaryPassword = escapeHtml(buildTemporaryPassword(employee));
    String intro = credentialsUpdated
        ? "Your employee profile has been updated in Kavya HRMS. Your login credentials have been refreshed."
        : "Welcome to Kavya HRMS. Your employee profile has been created successfully.";

    return "<div style=\"font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1f2937;\">"
        + "<p>Hello " + name + ",</p>"
        + "<p>" + escapeHtml(intro) + "</p>"
        + "<p>"
        + "Login Email: " + loginEmail + "<br/>"
        + "Temporary Password: <strong>" + temporaryPassword + "</strong><br/>"
        + "Employee Code: " + employeeCode + "<br/>"
        + "Department: " + department + "<br/>"
        + "Designation: " + jobTitle
        + "</p>"
        + "<p>Please sign in with the login email above and change your password after the first login.</p>"
        + "<p>If you have any questions, please contact the HR team.</p>"
        + "<p>Regards,<br/>Kavya HRMS</p>"
        + "</div>";
  }

  public String buildLoginEmail(Employee employee) {
    String firstName = normalizeNamePart(employee == null ? null : employee.getFirstName());
    String lastName = normalizeNamePart(employee == null ? null : employee.getLastName());

    String localPart = "";
    if (!firstName.isBlank() && !lastName.isBlank()) {
      localPart = firstName + "." + lastName;
    } else if (!firstName.isBlank()) {
      localPart = firstName;
    } else {
      String fallbackEmail = firstNonBlank(employee == null ? null : employee.getEmail(), "");
      int atIndex = fallbackEmail.indexOf('@');
      if (atIndex > 0) {
        localPart = fallbackEmail.substring(0, atIndex).trim().toLowerCase(Locale.ROOT);
      }
    }

    if (localPart.isBlank()) {
      return firstNonBlank(employee == null ? null : employee.getEmail(), "");
    }

    return localPart + "@kavyainfoweb.com";
  }

  public String buildTemporaryPassword(Employee employee) {
    String firstName = firstNonBlank(
        employee == null ? null : employee.getFirstName(),
        employee == null ? null : employee.getDisplayName(),
        employee == null ? null : employee.getName(),
        "Employee");
    String passwordBase = firstName.toLowerCase(Locale.ROOT);
    return passwordBase.substring(0, 1).toUpperCase(Locale.ROOT) + passwordBase.substring(1) + "@123";
  }

  private String normalizeNamePart(String value) {
    if (value == null) {
      return "";
    }

    return value.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", "");
  }

  private String escapeHtml(String value) {
    return value == null ? "" : HtmlUtils.htmlEscape(value);
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
      return sent("Welcome email sent.");
    }

    public static DeliveryResult sent(String message) {
      return new DeliveryResult(true, true, message == null || message.isBlank() ? "Employee credential email sent." : message);
    }

    public static DeliveryResult failed(String message) {
      return new DeliveryResult(true, false, message == null || message.isBlank() ? "Unable to send welcome email." : message);
    }

    public boolean isConfigured() { return configured; }
    public boolean isSent() { return sent; }
    public String getMessage() { return message; }
  }
}
