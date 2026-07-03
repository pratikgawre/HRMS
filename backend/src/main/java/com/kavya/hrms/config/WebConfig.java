package com.kavya.hrms.config;

import com.kavya.hrms.repository.AuthSessionRepository;
import java.nio.file.Paths;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@SuppressWarnings("all")
public class WebConfig implements WebMvcConfigurer {
  private final AuthSessionRepository authSessionRepository;

  public WebConfig(@Nullable AuthSessionRepository authSessionRepository) {
    this.authSessionRepository = authSessionRepository;
  }

  @Override
  public void addCorsMappings(@NonNull CorsRegistry registry) {
    registry.addMapping("/api/**")
        .allowedOriginPatterns("http://127.0.0.1:*", "http://localhost:*")
        .allowedMethods("*")
        .allowedHeaders("*");
  }

  @Override
  public void addInterceptors(@NonNull InterceptorRegistry registry) {
    AuthSessionRepository authSessionRepository = this.authSessionRepository;
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
