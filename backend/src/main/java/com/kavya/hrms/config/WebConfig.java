package com.kavya.hrms.config;

import java.nio.file.Paths;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {
  @Override
  public void addCorsMappings(@NonNull CorsRegistry registry) {
    registry.addMapping("/api/**")
        .allowedOriginPatterns("http://127.0.0.1:*", "http://localhost:*")
        .allowedMethods("*")
        .allowedHeaders("*");
  }

  @Override
  public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
    String uploadPath = Paths.get("uploads").toAbsolutePath().normalize().toUri().toString();
    registry.addResourceHandler("/uploads/**")
        .addResourceLocations(uploadPath);
  }
}
