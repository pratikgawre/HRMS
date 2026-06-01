package com.kavya.hrms.websocket;

import com.kavya.hrms.model.SystemSettings;
import java.io.IOException;
import java.time.Instant;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArraySet;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

@Component
public class SettingsBroadcastService {
  private final Set<WebSocketSession> sessions = new CopyOnWriteArraySet<>();

  public void register(WebSocketSession session) {
    sessions.add(session);
  }

  public void unregister(WebSocketSession session) {
    sessions.remove(session);
  }

  public void broadcastSettingsChanged(SystemSettings settings) {
    String payload = "{\"type\":\"settings-updated\",\"settingsId\":\""
        + escapeJson(settings != null ? settings.getId() : "default")
        + "\",\"timestamp\":\""
        + Instant.now().toString()
        + "\"}";
    TextMessage message = new TextMessage(payload);

    for (WebSocketSession session : sessions) {
      if (!session.isOpen()) {
        sessions.remove(session);
        continue;
      }

      try {
        session.sendMessage(message);
      } catch (IOException ex) {
        sessions.remove(session);
      }
    }
  }

  private String escapeJson(String value) {
    return String.valueOf(value == null ? "" : value)
        .replace("\\", "\\\\")
        .replace("\"", "\\\"");
  }
}
