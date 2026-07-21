package com.kavya.hrms.service;

import com.kavya.hrms.config.SmtpSettings;
import com.kavya.hrms.model.Interview;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;
import org.springframework.mail.MailException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;

@Service
public class InterviewNotificationEmailService {
  private static final Logger log = LoggerFactory.getLogger(InterviewNotificationEmailService.class);
  private static final DateTimeFormatter DISPLAY_DATE_FORMAT = DateTimeFormatter.ofPattern("dd MMM uuuu", Locale.ENGLISH);
  private static final DateTimeFormatter DISPLAY_TIME_FORMAT = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);

  private final SmtpSettings smtpSettings;
  private final SendGridMailClient sendGridMailClient;

  public InterviewNotificationEmailService(Environment environment) {
    this.smtpSettings = SmtpSettings.resolve(environment);
    this.sendGridMailClient = new SendGridMailClient(environment);
  }

  public DeliveryResult sendInterviewScheduleEmail(Interview interview) {
    return sendInterviewEmail(interview, false);
  }

  public DeliveryResult sendInterviewUpdateEmail(Interview interview) {
    return sendInterviewEmail(interview, true);
  }

  private DeliveryResult sendInterviewEmail(Interview interview, boolean update) {
    String to = businessValue(interview == null ? "" : interview.getEmail());
    if (to.isBlank()) {
      return DeliveryResult.failed("Candidate email is missing.");
    }

    String emailType = update ? "Interview update email" : "Interview schedule email";
    String subjectPrefix = update ? "Interview Updated - " : "Interview Scheduled - ";
    String subject = subjectPrefix + displayValue(interview == null ? "" : interview.getPosition(), "Kavya HRMS");
    String plainTextMessage = buildPlainTextMessage(interview, update);
    String htmlMessage = buildHtmlMessage(interview, update);

    if (sendGridMailClient.isEnabled()) {
      return sendInterviewEmailWithSendGrid(to, subject, plainTextMessage, htmlMessage, emailType);
    }

    if (!smtpSettings.isConfigured()) {
      log.warn("{} skipped because SMTP host is blank.", emailType);
      return DeliveryResult.notConfigured();
    }

    JavaMailSender mailSender = smtpSettings.createMailSender();
    String sender = resolveFromAddress();
    log.info("{} sending via SMTP {}:{} ssl={} timeout={}ms.",
        emailType,
        smtpSettings.getHost(),
        smtpSettings.getPort(),
        smtpSettings.isSslEnabled(),
        smtpSettings.getConnectionTimeoutMillis());

    try {
      MimeMessage mimeMessage = mailSender.createMimeMessage();
      MimeMessageHelper message = new MimeMessageHelper(mimeMessage, true, "UTF-8");
      message.setTo(to);
      if (!sender.isBlank()) {
        message.setFrom(sender);
      }
      message.setSubject(subject);
      message.setText(plainTextMessage, htmlMessage);

      mailSender.send(mimeMessage);
      log.info("{} sent to {} from {}.", emailType, to, sender.isBlank() ? "<smtp-default>" : sender);
      return DeliveryResult.sent();
    } catch (MailException | MessagingException ex) {
      log.error("Unable to send {} to {} from {}.", emailType, to, sender.isBlank() ? "<smtp-default>" : sender, ex);
      return DeliveryResult.failed("Interview email was not sent. Please check SMTP settings.");
    }
  }

  private DeliveryResult sendInterviewEmailWithSendGrid(
      String to,
      String subject,
      String plainTextMessage,
      String htmlMessage,
      String emailType) {
    SendGridMailClient.DeliveryResult delivery = sendGridMailClient.sendEmail(
        to,
        subject,
        plainTextMessage,
        htmlMessage,
        emailType);
    if (!delivery.isConfigured()) {
      return DeliveryResult.notConfigured(delivery.getMessage());
    }
    if (delivery.isSent()) {
      return DeliveryResult.sent();
    }
    return DeliveryResult.failed(delivery.getMessage());
  }

  String buildPlainTextMessage(Interview interview) {
    return buildPlainTextMessage(interview, false);
  }

  String buildPlainTextMessage(Interview interview, boolean update) {
    String name = displayValue(interview == null ? "" : interview.getCandidateName(), "Candidate");
    String meetingLink = displayValue(interview == null ? "" : interview.getMeetingLink(), "Not shared");
    String location = displayValue(interview == null ? "" : interview.getLocation(), "Not shared");
    String intro = update
        ? "Your interview details have been updated by Kavya HRMS. Please find the latest interview details below."
        : "Your interview has been scheduled by Kavya HRMS. Please find the interview details below.";

    return "Hello " + name + ",\n\n"
        + intro + "\n\n"
        + "Candidate Name: " + name + "\n"
        + "Position Applied: " + displayValue(interview == null ? "" : interview.getPosition(), "Not specified") + "\n"
        + "Department: " + displayValue(interview == null ? "" : interview.getDepartment(), "Not specified") + "\n"
        + "Interview Round: " + displayValue(interview == null ? "" : interview.getInterviewRound(), "Not specified") + "\n"
        + "Interview Mode: " + displayValue(interview == null ? "" : interview.getInterviewMode(), "Not specified") + "\n"
        + "Interview Date: " + formatDate(interview == null ? "" : interview.getInterviewDate()) + "\n"
        + "Interview Time: " + formatTime(interview == null ? "" : interview.getInterviewTime()) + "\n"
        + "Interviewer Name: " + displayValue(interview == null ? "" : interview.getInterviewer(), "Not specified") + "\n"
        + "Meeting Link: " + meetingLink + "\n"
        + "Interview Location: " + location + "\n"
        + "Remarks: " + displayValue(interview == null ? "" : interview.getRemarks(), "No remarks") + "\n\n"
        + "Please be available on time. If you have any questions, reply to the HR team.\n\n"
        + "Regards,\n"
        + "Kavya HRMS";
  }

  String buildHtmlMessage(Interview interview) {
    return buildHtmlMessage(interview, false);
  }

  String buildHtmlMessage(Interview interview, boolean update) {
    String name = escapeHtml(displayValue(interview == null ? "" : interview.getCandidateName(), "Candidate"));
    String meetingLink = businessValue(interview == null ? "" : interview.getMeetingLink());
    String meetingLinkDisplay = escapeHtml(meetingLink.isBlank() ? "Not shared" : meetingLink);
    String meetingLinkHref = escapeHtml(meetingLink);
    String title = update ? "Interview Details Updated" : "Interview Scheduled";
    String intro = update
        ? "Your interview details have been updated. Please review the latest details below."
        : "Your interview has been scheduled. Please review the details below.";

    return "<div style=\"margin:0; padding:0; background:#f4fbfb; font-family:Arial, sans-serif; color:#1f2937;\">"
        + "<div style=\"max-width:680px; margin:0 auto; padding:28px 18px;\">"
        + "<div style=\"background:#ffffff; border:1px solid #d8ecec; border-radius:12px; overflow:hidden;\">"
        + "<div style=\"background:#0f8f8b; padding:22px 26px; color:#ffffff;\">"
        + "<div style=\"font-size:12px; letter-spacing:1px; text-transform:uppercase; font-weight:700;\">Kavya HRMS</div>"
        + "<h1 style=\"margin:8px 0 0; font-size:24px; line-height:1.3; font-weight:700;\">" + escapeHtml(title) + "</h1>"
        + "</div>"
        + "<div style=\"padding:26px; font-size:14px; line-height:1.7;\">"
        + "<p style=\"margin:0 0 14px;\">Hello " + name + ",</p>"
        + "<p style=\"margin:0 0 22px;\">" + escapeHtml(intro) + "</p>"
        + "<div style=\"background:#f8fbfc; border:1px solid #d8e6ea; border-radius:10px; padding:18px; margin:0 0 22px;\">"
        + "<div style=\"font-size:12px; color:#64748b; font-weight:700; text-transform:uppercase; margin-bottom:10px;\">Interview Details</div>"
        + "<table role=\"presentation\" style=\"width:100%; border-collapse:collapse; font-size:14px;\">"
        + detailRow("Candidate Name", name)
        + detailRow("Position Applied", escapeHtml(displayValue(interview == null ? "" : interview.getPosition(), "Not specified")))
        + detailRow("Department", escapeHtml(displayValue(interview == null ? "" : interview.getDepartment(), "Not specified")))
        + detailRow("Interview Round", escapeHtml(displayValue(interview == null ? "" : interview.getInterviewRound(), "Not specified")))
        + detailRow("Interview Mode", escapeHtml(displayValue(interview == null ? "" : interview.getInterviewMode(), "Not specified")))
        + detailRow("Interview Date", escapeHtml(formatDate(interview == null ? "" : interview.getInterviewDate())))
        + detailRow("Interview Time", escapeHtml(formatTime(interview == null ? "" : interview.getInterviewTime())))
        + detailRow("Interviewer Name", escapeHtml(displayValue(interview == null ? "" : interview.getInterviewer(), "Not specified")))
        + detailRow("Meeting Link", meetingLink.isBlank() ? meetingLinkDisplay : "<a href=\"" + meetingLinkHref + "\" style=\"color:#0f766e; font-weight:700;\">" + meetingLinkDisplay + "</a>")
        + detailRow("Interview Location", escapeHtml(displayValue(interview == null ? "" : interview.getLocation(), "Not shared")))
        + detailRow("Remarks", escapeHtml(displayValue(interview == null ? "" : interview.getRemarks(), "No remarks")))
        + "</table>"
        + "</div>"
        + (meetingLink.isBlank()
            ? ""
            : "<p style=\"margin:0 0 22px;\"><a href=\"" + meetingLinkHref + "\" style=\"display:inline-block; background:#0f8f8b; color:#ffffff; text-decoration:none; font-weight:700; padding:12px 20px; border-radius:8px;\">Open Meeting Link</a></p>")
        + "<p style=\"margin:0 0 8px;\">Please be available on time. If you have any questions, reply to the HR team.</p>"
        + "<p style=\"margin:0;\">Regards,<br/>Kavya HRMS</p>"
        + "</div>"
        + "</div>"
        + "</div>"
        + "</div>";
  }

  private String detailRow(String label, String value) {
    return "<tr>"
        + "<td style=\"padding:7px 12px 7px 0; color:#64748b; width:40%; vertical-align:top;\">" + escapeHtml(label) + "</td>"
        + "<td style=\"padding:7px 0; color:#0f172a; font-weight:600; vertical-align:top;\">" + value + "</td>"
        + "</tr>";
  }

  private String formatDate(String value) {
    String safeValue = businessValue(value);
    if (safeValue.isBlank()) {
      return "Not specified";
    }
    try {
      return LocalDate.parse(safeValue).format(DISPLAY_DATE_FORMAT);
    } catch (DateTimeParseException ignored) {
      return safeValue;
    }
  }

  private String formatTime(String value) {
    String safeValue = businessValue(value);
    if (safeValue.isBlank()) {
      return "Not specified";
    }
    try {
      return LocalTime.parse(safeValue).format(DISPLAY_TIME_FORMAT);
    } catch (DateTimeParseException ignored) {
      return safeValue;
    }
  }

  private String resolveFromAddress() {
    return firstNonBlank(smtpSettings.getFromAddress(), smtpSettings.getUsername());
  }

  private String displayValue(String value, String fallback) {
    String safeValue = businessValue(value);
    return safeValue.isBlank() ? fallback : safeValue;
  }

  private String businessValue(String value) {
    if (value == null) {
      return "";
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() || "-".equals(trimmed) ? "" : trimmed;
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
      return notConfigured("Email service is not configured.");
    }

    public static DeliveryResult notConfigured(String message) {
      return new DeliveryResult(false, false, message == null || message.isBlank() ? "Email service is not configured." : message);
    }

    public static DeliveryResult sent() {
      return new DeliveryResult(true, true, "Interview email sent.");
    }

    public static DeliveryResult failed(String message) {
      return new DeliveryResult(true, false, message == null || message.isBlank() ? "Unable to send interview email." : message);
    }

    public boolean isConfigured() { return configured; }
    public boolean isSent() { return sent; }
    public String getMessage() { return message; }
  }
}