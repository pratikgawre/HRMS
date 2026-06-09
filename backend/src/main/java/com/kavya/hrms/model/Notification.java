package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "notifications")
public class Notification {
  @Id
  private String id;
  private String userId;
  private String title;
  private String message;
  private Boolean readStatus;
  private String createdAt;
  private String sourceType;
  private String sourceId;
  private String createdByRole;
  private String createdByName;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getMessage() { return message; }
  public void setMessage(String message) { this.message = message; }
  public Boolean getReadStatus() { return readStatus; }
  public void setReadStatus(Boolean readStatus) { this.readStatus = readStatus; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
  public String getSourceType() { return sourceType; }
  public void setSourceType(String sourceType) { this.sourceType = sourceType; }
  public String getSourceId() { return sourceId; }
  public void setSourceId(String sourceId) { this.sourceId = sourceId; }
  public String getCreatedByRole() { return createdByRole; }
  public void setCreatedByRole(String createdByRole) { this.createdByRole = createdByRole; }
  public String getCreatedByName() { return createdByName; }
  public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }
}
