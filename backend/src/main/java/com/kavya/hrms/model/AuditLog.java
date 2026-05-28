package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "audit_logs")
public class AuditLog {
  @Id
  private String id;
  private String userId;
  private String action;
  private String module;
  private String recordId;
  private String timestamp;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getAction() { return action; }
  public void setAction(String action) { this.action = action; }
  public String getModule() { return module; }
  public void setModule(String module) { this.module = module; }
  public String getRecordId() { return recordId; }
  public void setRecordId(String recordId) { this.recordId = recordId; }
  public String getTimestamp() { return timestamp; }
  public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
}
