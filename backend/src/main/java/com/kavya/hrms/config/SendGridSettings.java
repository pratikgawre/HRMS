package com.kavya.hrms.config;

import org.springframework.core.env.Environment;

public final class SendGridSettings {
  private static final String PROVIDER_SENDGRID = "sendgrid";
  private static final int DEFAULT_TIMEOUT_MILLIS = 10000;

  private final String provider;
  private final String apiKey;
  private final String fromAddress;
  private final String fromName;
  private final String apiUrl;
  private final int timeoutMillis;

  private SendGridSettings(
      String provider,
      String apiKey,
      String fromAddress,
      String fromName,
      String apiUrl,
      int timeoutMillis) {
    this.provider = provider == null ? "" : provider.trim();
    this.apiKey = apiKey == null ? "" : apiKey.trim();
    this.fromAddress = fromAddress == null ? "" : fromAddress.trim();
    this.fromName = fromName == null ? "" : fromName.trim();
    this.apiUrl = apiUrl == null || apiUrl.isBlank() ? "https://api.sendgrid.com/v3/mail/send" : apiUrl.trim();
    this.timeoutMillis = timeoutMillis > 0 ? timeoutMillis : DEFAULT_TIMEOUT_MILLIS;
  }

  public static SendGridSettings resolve(Environment environment) {
    Environment safeEnvironment = environment;
    return new SendGridSettings(
        firstNonBlank(readEnvironmentValue(safeEnvironment, "app.mail.provider"), readEnvironmentValue(safeEnvironment, "MAIL_PROVIDER"), "smtp"),
        firstNonBlank(readEnvironmentValue(safeEnvironment, "sendgrid.api-key"), readEnvironmentValue(safeEnvironment, "SENDGRID_API_KEY")),
        firstNonBlank(readEnvironmentValue(safeEnvironment, "sendgrid.from"), readEnvironmentValue(safeEnvironment, "SENDGRID_FROM")),
        firstNonBlank(readEnvironmentValue(safeEnvironment, "sendgrid.from-name"), readEnvironmentValue(safeEnvironment, "SENDGRID_FROM_NAME"), "Kavya HRMS"),
        firstNonBlank(readEnvironmentValue(safeEnvironment, "sendgrid.api-url"), readEnvironmentValue(safeEnvironment, "SENDGRID_API_URL"), "https://api.sendgrid.com/v3/mail/send"),
        parseTimeout(firstNonBlank(readEnvironmentValue(safeEnvironment, "sendgrid.timeout-ms"), readEnvironmentValue(safeEnvironment, "SENDGRID_TIMEOUT_MS"))));
  }

  public boolean isEnabled() {
    return PROVIDER_SENDGRID.equalsIgnoreCase(provider);
  }

  public boolean isConfigured() {
    return isEnabled() && !apiKey.isBlank() && !fromAddress.isBlank();
  }

  public String getProvider() {
    return provider;
  }

  public String getApiKey() {
    return apiKey;
  }

  public String getFromAddress() {
    return fromAddress;
  }

  public String getFromName() {
    return fromName;
  }

  public String getApiUrl() {
    return apiUrl;
  }

  public int getTimeoutMillis() {
    return timeoutMillis;
  }

  public String missingConfigurationMessage() {
    if (!isEnabled()) {
      return "SendGrid email provider is not enabled.";
    }
    if (apiKey.isBlank()) {
      return "SendGrid API key is missing. Set SENDGRID_API_KEY in Render.";
    }
    if (fromAddress.isBlank()) {
      return "SendGrid sender email is missing. Set SENDGRID_FROM in Render.";
    }
    return "SendGrid email service is not configured.";
  }

  private static String readEnvironmentValue(Environment environment, String key) {
    if (environment == null) {
      return "";
    }

    String value = environment.getProperty(key);
    return value == null ? "" : value.trim();
  }

  private static int parseTimeout(String value) {
    if (value == null || value.isBlank()) {
      return DEFAULT_TIMEOUT_MILLIS;
    }

    try {
      int parsed = Integer.parseInt(value.trim());
      return parsed > 0 ? parsed : DEFAULT_TIMEOUT_MILLIS;
    } catch (NumberFormatException ex) {
      return DEFAULT_TIMEOUT_MILLIS;
    }
  }

  private static String firstNonBlank(String... values) {
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
}