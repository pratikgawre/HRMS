package com.kavya.hrms.websocket;

import java.io.IOException;
import org.jspecify.annotations.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
@SuppressWarnings("all")
public class SettingsWebSocketHandler extends TextWebSocketHandler {
  private final SettingsBroadcastService broadcastService;

  public SettingsWebSocketHandler(SettingsBroadcastService broadcastService) {
    this.broadcastService = broadcastService;
  }

  @Override
  public void afterConnectionEstablished(@NonNull WebSocketSession session) throws Exception {
    broadcastService.register(session);
    try {
      if (session.isOpen()) {
        session.sendMessage(new TextMessage("{\"type\":\"settings-connected\"}"));
      }
    } catch (IOException ex) {
      broadcastService.unregister(session);
      try {
        session.close();
      } catch (IOException ignored) {
        // Ignore close errors when the client disconnects during handshake.
      }
    }
  }

  @Override
  public void afterConnectionClosed(@NonNull WebSocketSession session, @NonNull CloseStatus status) throws Exception {
    broadcastService.unregister(session);
  }

  @Override
  public void handleTransportError(@NonNull WebSocketSession session, @NonNull Throwable exception) throws Exception {
    broadcastService.unregister(session);
    try {
      session.close();
    } catch (IOException ignored) {
      // Ignore close errors on transport failure.
    }
  }
}
