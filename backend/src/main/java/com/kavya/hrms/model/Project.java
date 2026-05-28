package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "projects")
public class Project {
  @Id
  private String id;
  private String name;
  private String description;
  private String manager;
  private String managerId;
  private String team;
  private String milestone;
  private String startDate;
  private String endDate;
  private String progress;
  private String status;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public String getManager() { return manager; }
  public void setManager(String manager) { this.manager = manager; }
  public String getManagerId() { return managerId; }
  public void setManagerId(String managerId) { this.managerId = managerId; }
  public String getTeam() { return team; }
  public void setTeam(String team) { this.team = team; }
  public String getMilestone() { return milestone; }
  public void setMilestone(String milestone) { this.milestone = milestone; }
  public String getStartDate() { return startDate; }
  public void setStartDate(String startDate) { this.startDate = startDate; }
  public String getEndDate() { return endDate; }
  public void setEndDate(String endDate) { this.endDate = endDate; }
  public String getProgress() { return progress; }
  public void setProgress(String progress) { this.progress = progress; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
