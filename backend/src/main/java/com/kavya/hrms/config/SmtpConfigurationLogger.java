package com.kavya.hrms.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class SmtpConfigurationLogger {
  private static final Logger log = LoggerFactory.getLogger(SmtpConfigurationLogger.class);

  @Bean
  @SuppressWarnings("unused")
  ApplicationRunner smtpConfigurationWarningRunner(
      @Value("${spring.mail.host:}") String host,
      @Value("${spring.mail.username:}") String username,
      @Value("${spring.mail.password:}") String password,
      @Value("${spring.mail.from:}") String fromAddress) {
    return args -> {
      String safeHost = host == null ? "" : host.trim();
      String safeUsername = username == null ? "" : username.trim();
      String safePassword = password == null ? "" : password.trim();
      String safeFromAddress = fromAddress == null ? "" : fromAddress.trim();

      if (safeHost.isBlank()) {
        log.warn("SMTP is not configured. Email features will stay available but delivery will be skipped until spring.mail.host is provided.");
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
