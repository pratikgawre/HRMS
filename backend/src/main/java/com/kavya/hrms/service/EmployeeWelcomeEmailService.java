package com.kavya.hrms.service;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.config.SmtpSettings;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.jspecify.annotations.NonNull;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

@Service
@SuppressWarnings("all")
public class EmployeeWelcomeEmailService {
  private static final Logger log = LoggerFactory.getLogger(EmployeeWelcomeEmailService.class);
  private final ObjectProvider<JavaMailSender> mailSenderProvider;
  private final SmtpSettings smtpSettings;

  public EmployeeWelcomeEmailService(
      ObjectProvider<JavaMailSender> mailSenderProvider,
      Environment environment) {
    this.mailSenderProvider = mailSenderProvider;
    this.smtpSettings = SmtpSettings.resolve(environment);
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
      @NonNull String subject,
      @NonNull String plainTextMessage,
      @NonNull String htmlMessage,
      @NonNull String emailType,
      @NonNull String successMessage) {
    if (!smtpSettings.isConfigured()) {
      log.warn("{} skipped because SMTP host is blank.", emailType);
      return DeliveryResult.notConfigured();
    }

    String to = employee == null || employee.getEmail() == null ? "" : employee.getEmail().trim();
    if (to.isBlank()) {
      return DeliveryResult.failed("Employee email is missing.");
    }

    JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
    if (mailSender == null) {
      mailSender = smtpSettings.createMailSender();
    }

    try {
      MimeMessage mimeMessage = mailSender.createMimeMessage();
      MimeMessageHelper message = new MimeMessageHelper(mimeMessage, true, "UTF-8");
      message.setTo(to);
      String sender = resolveFromAddress();
      if (!sender.isBlank()) {
        message.setFrom(sender);
      }
      message.setSubject(subject);
      message.setText(plainTextMessage, htmlMessage);

      mailSender.send(mimeMessage);
      log.info("{} sent to {} from {}.", emailType, to, sender.isBlank() ? "<smtp-default>" : sender);
      return DeliveryResult.sent(successMessage);
    } catch (MailException | MessagingException ex) {
      String sender = resolveFromAddress();
      log.error("Unable to send {} to {} from {}.", emailType, to, sender.isBlank() ? "<smtp-default>" : sender, ex);
      return DeliveryResult.failed("Unable to send employee credential email: " + ex.getMessage());
    }
  }

  @NonNull
  private String resolveFromAddress() {
    return firstNonBlank(smtpSettings.getFromAddress(), smtpSettings.getUsername());
  }

  @NonNull
  private String buildPlainTextMessage(Employee employee, boolean credentialsUpdated) {
    String displayName = employee == null ? "" : safe(employee.getDisplayName());
    String alternateName = employee == null ? "" : safe(employee.getName());
    String firstName = employee == null ? "" : safe(employee.getFirstName());
    String departmentValue = employee == null ? "" : safe(employee.getDepartment());
    String jobTitleValue = employee == null ? "" : safe(employee.getJobTitle());
    String employeeCodeValue = employee == null ? "" : safe(employee.getEmployeeCode());
    String name = firstNonBlank(displayName, alternateName, firstName, "there");
    String loginEmail = buildLoginEmail(employee);
    String department = firstNonBlank(departmentValue, "your department");
    String jobTitle = firstNonBlank(jobTitleValue, "your role");
    String employeeCode = firstNonBlank(employeeCodeValue, "not assigned yet");
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

  @NonNull
  private String buildHtmlMessage(Employee employee, boolean credentialsUpdated) {
    String displayName = employee == null ? "" : safe(employee.getDisplayName());
    String alternateName = employee == null ? "" : safe(employee.getName());
    String firstName = employee == null ? "" : safe(employee.getFirstName());
    String departmentValue = employee == null ? "" : safe(employee.getDepartment());
    String jobTitleValue = employee == null ? "" : safe(employee.getJobTitle());
    String employeeCodeValue = employee == null ? "" : safe(employee.getEmployeeCode());
    String name = escapeHtml(firstNonBlank(displayName, alternateName, firstName, "there"));
    String loginEmail = escapeHtml(buildLoginEmail(employee));
    String department = escapeHtml(firstNonBlank(departmentValue, "your department"));
    String jobTitle = escapeHtml(firstNonBlank(jobTitleValue, "your role"));
    String employeeCode = escapeHtml(firstNonBlank(employeeCodeValue, "not assigned yet"));
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

  @NonNull
  public String buildLoginEmail(Employee employee) {
    String firstName = normalizeNamePart(employee == null ? "" : safe(employee.getFirstName()));
    String lastName = normalizeNamePart(employee == null ? "" : safe(employee.getLastName()));

    String localPart = "";
    if (!firstName.isBlank() && !lastName.isBlank()) {
      localPart = firstName + lastName;
    } else if (!firstName.isBlank()) {
      localPart = firstName;
    } else {
      String fallbackEmail = firstNonBlank(employee == null ? "" : safe(employee.getEmail()), "");
      int atIndex = fallbackEmail.indexOf('@');
      if (atIndex > 0) {
        localPart = fallbackEmail.substring(0, atIndex).trim().toLowerCase(Locale.ROOT);
      }
    }

    if (localPart.isBlank()) {
      String fallbackEmail = employee == null ? "" : safe(employee.getEmail());
      return fallbackEmail;
    }

    return localPart + "@kavyainfoweb.com";
  }

  @NonNull
  public String buildTemporaryPassword(Employee employee) {
    String firstName = firstNonBlank(
        employee == null ? "" : safe(employee.getFirstName()),
        employee == null ? "" : safe(employee.getDisplayName()),
        employee == null ? "" : safe(employee.getName()),
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

  @NonNull
  private String safe(String value) {
    return value == null ? "" : value;
  }

  @NonNull
  private String firstNonBlank(@Nullable String... values) {
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

