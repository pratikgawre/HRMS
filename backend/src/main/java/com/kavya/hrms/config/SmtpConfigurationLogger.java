package com.kavya.hrms.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

@Configuration
public class SmtpConfigurationLogger {
  private static final Logger log = LoggerFactory.getLogger(SmtpConfigurationLogger.class);

  @Bean
  ApplicationRunner smtpConfigurationWarningRunner(
      Environment environment) {
    return args -> {
      SmtpSettings settings = SmtpSettings.resolve(environment);
      String safeHost = settings.getHost();
      String safeUsername = settings.getUsername();
      String safePassword = settings.getPassword();
      String safeFromAddress = settings.getFromAddress();

      if (safeHost.isBlank()) {
        log.warn("SMTP is not configured. Email delivery will be skipped until the app can resolve a host from spring.mail.host, SMTP_HOST, or the .env file.");
        return;
      }

      if (safeUsername.isBlank() || safePassword.isBlank()) {
        log.warn("SMTP host '{}' is configured without complete credentials. The application will start, but email delivery may fail until spring.mail.username and spring.mail.password are provided.", safeHost);
      }

      if (safeFromAddress.isBlank() && safeUsername.isBlank()) {
        log.warn("SMTP host '{}' is configured without spring.mail.from or spring.mail.username. The mail server must supply a default sender address.", safeHost);
      }
    };
  }
}
