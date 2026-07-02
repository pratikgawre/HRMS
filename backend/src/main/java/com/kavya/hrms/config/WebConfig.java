package com.kavya.hrms.config;

import com.kavya.hrms.repository.AuthSessionRepository;
import java.nio.file.Paths;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.jspecify.annotations.NonNull;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@SuppressWarnings("all")
public class WebConfig implements WebMvcConfigurer {
  @Autowired(required = false)
  private AuthSessionRepository authSessionRepository;

  @Override
  public void addCorsMappings(@NonNull CorsRegistry registry) {
    registry.addMapping("/api/**")
        .allowedOriginPatterns("http://127.0.0.1:*", "http://localhost:*")
        .allowedMethods("*")
        .allowedHeaders("*");
  }

  @Override
  public void addInterceptors(@NonNull InterceptorRegistry registry) {
    if (authSessionRepository == null) {
      return;
    }

    registry.addInterceptor(new ForcedPasswordChangeInterceptor(authSessionRepository))
        .addPathPatterns("/api/**");
  }

  @Override
  public void addResourceHandlers(@NonNull ResourceHandlerRegistry registry) {
    String uploadPath = Paths.get("uploads").toAbsolutePath().normalize().toUri().toString();
    if (!uploadPath.endsWith("/")) {
      uploadPath += "/";
    }
    registry.addResourceHandler("/uploads/**")
        .addResourceLocations(uploadPath);
  }
}