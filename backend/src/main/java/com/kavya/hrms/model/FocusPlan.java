package com.kavya.hrms.model;

import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "focusPlans")
public class FocusPlan {
  @Id
  private String id;
  private String userId;
  private String accessRole;
  private String role;
  private String title;
  private List<FocusPlanItem> items;
  private String createdAt;
  private long createdAtEpoch;
  private String createdByName;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getAccessRole() { return accessRole; }
  public void setAccessRole(String accessRole) { this.accessRole = accessRole; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public List<FocusPlanItem> getItems() { return items; }
  public void setItems(List<FocusPlanItem> items) { this.items = items; }
  public String getCreatedAt() { return createdAt; }
  public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
  public long getCreatedAtEpoch() { return createdAtEpoch; }
  public void setCreatedAtEpoch(long createdAtEpoch) { this.createdAtEpoch = createdAtEpoch; }
  public String getCreatedByName() { return createdByName; }
  public void setCreatedByName(String createdByName) { this.createdByName = createdByName; }
}
