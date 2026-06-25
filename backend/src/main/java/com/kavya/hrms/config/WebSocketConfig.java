package com.kavya.hrms.config;

import com.kavya.hrms.websocket.SettingsWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.lang.NonNull;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {
  private final @NonNull SettingsWebSocketHandler settingsWebSocketHandler;

  public WebSocketConfig(@NonNull SettingsWebSocketHandler settingsWebSocketHandler) {
    this.settingsWebSocketHandler = settingsWebSocketHandler;
  }

  @Override
  public void registerWebSocketHandlers(@NonNull WebSocketHandlerRegistry registry) {
    WebSocketHandler handler = (WebSocketHandler) settingsWebSocketHandler;
    registry.addHandler(handler, "/ws/settings")
        .setAllowedOrigins("http://127.0.0.1:5173", "http://localhost:5173");
  }
}
