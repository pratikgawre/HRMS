package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "announcements")
public class Announcement {
  @Id
  private String id;
  private String title;
  private String body;
  private String category;
  private String priority;
  private String dateLabel;
  private String postedAt;
  private String postedBy;
  private String ownerRole;
  private String status;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getBody() { return body; }
  public void setBody(String body) { this.body = body; }
  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }
  public String getPriority() { return priority; }
  public void setPriority(String priority) { this.priority = priority; }
  public String getDateLabel() { return dateLabel; }
  public void setDateLabel(String dateLabel) { this.dateLabel = dateLabel; }
  public String getPostedAt() { return postedAt; }
  public void setPostedAt(String postedAt) { this.postedAt = postedAt; }
  public String getPostedBy() { return postedBy; }
  public void setPostedBy(String postedBy) { this.postedBy = postedBy; }
  public String getOwnerRole() { return ownerRole; }
  public void setOwnerRole(String ownerRole) { this.ownerRole = ownerRole; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
