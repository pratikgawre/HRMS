package com.kavya.hrms.service;

import com.kavya.hrms.config.SendGridSettings;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.env.Environment;

public final class SendGridMailClient {
  private static final Logger log = LoggerFactory.getLogger(SendGridMailClient.class);
  private final SendGridSettings settings;
  private final HttpClient httpClient;

  public SendGridMailClient(Environment environment) {
    this(SendGridSettings.resolve(environment), HttpClient.newHttpClient());
  }

  SendGridMailClient(SendGridSettings settings, HttpClient httpClient) {
    this.settings = settings;
    this.httpClient = httpClient;
  }

  public boolean isEnabled() {
    return settings.isEnabled();
  }

  public DeliveryResult sendEmail(String to, String subject, String plainText, String html, String emailType) {
    String safeEmailType = emailType == null || emailType.isBlank() ? "Email" : emailType.trim();
    String recipient = to == null ? "" : to.trim();
    if (recipient.isBlank()) {
      return DeliveryResult.failed("Recipient email is missing.");
    }

    if (!settings.isConfigured()) {
      log.warn("{} skipped because SendGrid is not configured: {}", safeEmailType, settings.missingConfigurationMessage());
      return DeliveryResult.notConfigured(settings.missingConfigurationMessage());
    }

    String payload = buildPayload(recipient, subject, plainText, html);
    HttpRequest request = HttpRequest.newBuilder(URI.create(settings.getApiUrl()))
        .timeout(Duration.ofMillis(settings.getTimeoutMillis()))
        .header("Authorization", "Bearer " + settings.getApiKey())
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
        .build();

    try {
      log.info("{} sending via SendGrid API to {} from {}.", safeEmailType, recipient, settings.getFromAddress());
      HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      int status = response.statusCode();
      if (status >= 200 && status < 300) {
        log.info("{} sent via SendGrid to {} from {}. status={}", safeEmailType, recipient, settings.getFromAddress(), status);
        return DeliveryResult.sent("Email sent via SendGrid.");
      }

      String body = summarizeResponseBody(response.body());
      log.error("{} SendGrid API request failed. status={} body={}", safeEmailType, status, body);
      return DeliveryResult.failed(buildFailureMessage(status, body));
    } catch (IOException ex) {
      log.error("{} SendGrid API request failed due to network error.", safeEmailType, ex);
      return DeliveryResult.failed("Email was not sent because SendGrid API could not be reached. Check Render network and SENDGRID_API_URL.");
    } catch (InterruptedException ex) {
      Thread.currentThread().interrupt();
      log.error("{} SendGrid API request was interrupted.", safeEmailType, ex);
      return DeliveryResult.failed("Email was not sent because the SendGrid request was interrupted.");
    } catch (IllegalArgumentException ex) {
      log.error("{} SendGrid API request is invalid.", safeEmailType, ex);
      return DeliveryResult.failed("Email was not sent because SendGrid API URL is invalid. Check SENDGRID_API_URL.");
    }
  }

  private String buildPayload(String to, String subject, String plainText, String html) {
    StringBuilder payload = new StringBuilder();
    payload.append('{');
    payload.append("\"personalizations\":[{\"to\":[{\"email\":").append(jsonString(to)).append("}]}],");
    payload.append("\"from\":{");
    payload.append("\"email\":").append(jsonString(settings.getFromAddress()));
    if (!settings.getFromName().isBlank()) {
      payload.append(",\"name\":").append(jsonString(settings.getFromName()));
    }
    payload.append("},");
    payload.append("\"subject\":").append(jsonString(subject == null ? "" : subject)).append(',');
    payload.append("\"content\":[");
    payload.append("{\"type\":\"text/plain\",\"value\":").append(jsonString(plainText == null ? "" : plainText)).append('}');
    if (html != null && !html.isBlank()) {
      payload.append(",{\"type\":\"text/html\",\"value\":").append(jsonString(html)).append('}');
    }
    payload.append(']');
    payload.append('}');
    return payload.toString();
  }

  private String buildFailureMessage(int status, String responseBody) {
    String detail = String.valueOf(responseBody == null ? "" : responseBody).toLowerCase(Locale.ROOT);
    if (status == 401 || status == 403 || detail.contains("authorization") || detail.contains("api key")) {
      return "Email was not sent because SendGrid rejected the API key. Check SENDGRID_API_KEY in Render.";
    }

    if (detail.contains("from") || detail.contains("sender") || detail.contains("verified") || detail.contains("authenticated")) {
      return "Email was not sent because SendGrid did not allow the sender. Verify SENDGRID_FROM with Sender Authentication or Domain Authentication.";
    }

    if (status == 429) {
      return "Email was not sent because SendGrid rate limit was reached.";
    }

    return "Email was not sent because SendGrid rejected the request (HTTP " + status + "). Check SendGrid Activity and Render logs.";
  }

  private String summarizeResponseBody(String body) {
    String trimmed = String.valueOf(body == null ? "" : body).trim().replaceAll("\\s+", " ");
    if (trimmed.isBlank()) {
      return "<empty>";
    }
    return trimmed.length() > 1000 ? trimmed.substring(0, 1000) + "..." : trimmed;
  }

  private String jsonString(String value) {
    String safeValue = value == null ? "" : value;
    StringBuilder escaped = new StringBuilder(safeValue.length() + 16);
    escaped.append('"');
    for (int index = 0; index < safeValue.length(); index += 1) {
      char character = safeValue.charAt(index);
      switch (character) {
        case '"':
          escaped.append("\\\"");
          break;
        case '\\':
          escaped.append("\\\\");
          break;
        case '\b':
          escaped.append("\\b");
          break;
        case '\f':
          escaped.append("\\f");
          break;
        case '\n':
          escaped.append("\\n");
          break;
        case '\r':
          escaped.append("\\r");
          break;
        case '\t':
          escaped.append("\\t");
          break;
        default:
          if (character < 0x20) {
            escaped.append(String.format("\\u%04x", (int) character));
          } else {
            escaped.append(character);
          }
          break;
      }
    }
    escaped.append('"');
    return escaped.toString();
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

    public static DeliveryResult notConfigured(String message) {
      return new DeliveryResult(false, false, message == null || message.isBlank() ? "SendGrid email service is not configured." : message);
    }

    public static DeliveryResult sent(String message) {
      return new DeliveryResult(true, true, message == null || message.isBlank() ? "Email sent via SendGrid." : message);
    }

    public static DeliveryResult failed(String message) {
      return new DeliveryResult(true, false, message == null || message.isBlank() ? "Unable to send email via SendGrid." : message);
    }

    public boolean isConfigured() { return configured; }
    public boolean isSent() { return sent; }
    public String getMessage() { return message; }
  }
}