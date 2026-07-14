package com.kavya.hrms.config;

import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Properties;
import org.springframework.core.env.Environment;
import org.springframework.mail.javamail.JavaMailSenderImpl;

public final class SmtpSettings {
  private static final List<String> CANDIDATE_ENV_PATHS = List.of(
      ".env",
      "React Project/backend/.env",
      "React Project/.env",
      "backend/.env",
      "../backend/.env",
      "../React Project/backend/.env",
      "../../backend/.env",
      "../../React Project/backend/.env",
      "../.env",
      "../../.env");

  private final String host;
  private final int port;
  private final String username;
  private final String password;
  private final String fromAddress;

  private SmtpSettings(String host, int port, String username, String password, String fromAddress) {
    this.host = host == null ? "" : host.trim();
    this.port = port > 0 ? port : 587;
    this.username = username == null ? "" : username.trim();
    this.password = password == null ? "" : password.trim();
    this.fromAddress = fromAddress == null ? "" : fromAddress.trim();
  }

  public static SmtpSettings resolve(Environment environment) {
    Environment safeEnvironment = environment;
    String username = firstNonBlank(
        readEnvironmentValue(safeEnvironment, "spring.mail.username"),
        readEnvironmentValue(safeEnvironment, "SMTP_USERNAME"),
        readFromEnvFiles("SMTP_USERNAME"));
    String host = firstNonBlank(
        readEnvironmentValue(safeEnvironment, "spring.mail.host"),
        readEnvironmentValue(safeEnvironment, "SMTP_HOST"),
        readFromEnvFiles("SMTP_HOST"));
    String password = firstNonBlank(
        readEnvironmentValue(safeEnvironment, "spring.mail.password"),
        readEnvironmentValue(safeEnvironment, "SMTP_PASSWORD"),
        readFromEnvFiles("SMTP_PASSWORD"));
    String fromAddress = firstNonBlank(
        readEnvironmentValue(safeEnvironment, "spring.mail.from"),
        readEnvironmentValue(safeEnvironment, "SMTP_FROM"),
        readFromEnvFiles("SMTP_FROM"),
        username);
    int port = parsePort(firstNonBlank(
        readEnvironmentValue(safeEnvironment, "spring.mail.port"),
        readEnvironmentValue(safeEnvironment, "SMTP_PORT"),
        readFromEnvFiles("SMTP_PORT")));
    return new SmtpSettings(host, port, username, password, fromAddress);
  }

  public boolean isConfigured() {
    return !host.isBlank();
  }

  public String getHost() {
    return host;
  }

  public int getPort() {
    return port;
  }

  public String getUsername() {
    return username;
  }

  public String getPassword() {
    return password;
  }

  public String getFromAddress() {
    return fromAddress;
  }

  public JavaMailSenderImpl createMailSender() {
    JavaMailSenderImpl mailSender = new JavaMailSenderImpl();
    mailSender.setHost(host);
    mailSender.setPort(port);
    if (!username.isBlank()) {
      mailSender.setUsername(username);
    }
    if (!password.isBlank()) {
      mailSender.setPassword(password);
    }

    Properties properties = mailSender.getJavaMailProperties();
    properties.put("mail.smtp.auth", "true");
    properties.put("mail.smtp.starttls.enable", "true");
    properties.put("mail.mime.charset", StandardCharsets.UTF_8.name());
    return mailSender;
  }

  private static String readEnvironmentValue(Environment environment, String key) {
    if (environment == null) {
      return "";
    }

    String value = environment.getProperty(key);
    return value == null ? "" : value.trim();
  }

  private static String readFromEnvFiles(String key) {
    for (Path candidate : candidateEnvFiles()) {
      String value = readValueFromFile(candidate, key);
      if (!value.isBlank()) {
        return value;
      }
    }
    return "";
  }

  private static List<Path> candidateEnvFiles() {
    List<Path> candidates = new ArrayList<>();
    for (String relativePath : CANDIDATE_ENV_PATHS) {
      candidates.add(Paths.get(relativePath).toAbsolutePath().normalize());
    }
    return candidates;
  }

  private static String readValueFromFile(Path file, String key) {
    if (file == null || !Files.isRegularFile(file)) {
      return "";
    }

    try (BufferedReader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8)) {
      String line;
      while ((line = reader.readLine()) != null) {
        String parsed = parseEnvLine(line, key);
        if (parsed != null) {
          return parsed;
        }
      }
    } catch (IOException ignored) {
      // Skip unreadable files and keep searching the remaining candidates.
    }
    return "";
  }

  private static String parseEnvLine(String line, String key) {
    if (line == null) {
      return null;
    }

    String trimmed = line.trim();
    if (trimmed.isEmpty() || trimmed.startsWith("#")) {
      return null;
    }
    if (trimmed.startsWith("export ")) {
      trimmed = trimmed.substring("export ".length()).trim();
    }

    int equalsIndex = trimmed.indexOf('=');
    if (equalsIndex < 1) {
      return null;
    }

    String candidateKey = trimmed.substring(0, equalsIndex).trim();
    if (!Objects.equals(candidateKey, key)) {
      return null;
    }

    String value = trimmed.substring(equalsIndex + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\""))
        || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length() - 1);
    }
    return value.trim();
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

  private static int parsePort(String value) {
    if (value == null || value.isBlank()) {
      return 587;
    }

    try {
      return Integer.parseInt(value.trim());
    } catch (NumberFormatException ex) {
      return 587;
    }
  }
}
