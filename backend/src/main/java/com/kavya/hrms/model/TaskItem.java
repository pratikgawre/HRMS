package com.kavya.hrms.model;

import java.util.ArrayList;
import java.util.List;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "tasks")
public class TaskItem {
  @Id
  private String id;
  private String title;
  private String description;
  private String owner;
  private String assignedToId;
  private String assignedToName;
  private String assignedTo;
  private String assignedById;
  private String assignedByName;
  private String assignedBy;
  private String assignedByRole;
  private String priority;
  private String dueDate;
  private String status;
  private String teamLeadId;
  private String projectId;
  private String projectName;
  private String projectCode;
  private String createdDateTime;
  private String taskSummary;
  private String attachmentUrl;
  private String attachmentName;
  private String attachmentType;
  private List<Attachment> attachments = new ArrayList<>();

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public String getOwner() { return owner; }
  public void setOwner(String owner) { this.owner = owner; }
  public String getAssignedToId() { return assignedToId; }
  public void setAssignedToId(String assignedToId) { this.assignedToId = assignedToId; }
  public String getAssignedToName() { return assignedToName; }
  public void setAssignedToName(String assignedToName) { this.assignedToName = assignedToName; }
  public String getAssignedTo() { return assignedTo; }
  public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
  public String getAssignedById() { return assignedById; }
  public void setAssignedById(String assignedById) { this.assignedById = assignedById; }
  public String getAssignedByName() { return assignedByName; }
  public void setAssignedByName(String assignedByName) { this.assignedByName = assignedByName; }
  public String getAssignedBy() { return assignedBy; }
  public void setAssignedBy(String assignedBy) { this.assignedBy = assignedBy; }
  public String getAssignedByRole() { return assignedByRole; }
  public void setAssignedByRole(String assignedByRole) { this.assignedByRole = assignedByRole; }
  public String getPriority() { return priority; }
  public void setPriority(String priority) { this.priority = priority; }
  public String getDueDate() { return dueDate; }
  public void setDueDate(String dueDate) { this.dueDate = dueDate; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getTeamLeadId() { return teamLeadId; }
  public void setTeamLeadId(String teamLeadId) { this.teamLeadId = teamLeadId; }
  public String getProjectId() { return projectId; }
  public void setProjectId(String projectId) { this.projectId = projectId; }
  public String getProjectName() { return projectName; }
  public void setProjectName(String projectName) { this.projectName = projectName; }
  public String getProjectCode() { return projectCode; }
  public void setProjectCode(String projectCode) { this.projectCode = projectCode; }
  public String getCreatedDateTime() { return createdDateTime; }
  public void setCreatedDateTime(String createdDateTime) { this.createdDateTime = createdDateTime; }
  public String getTaskSummary() { return taskSummary; }
  public void setTaskSummary(String taskSummary) { this.taskSummary = taskSummary; }
  public String getAttachmentUrl() { return attachmentUrl; }
  public void setAttachmentUrl(String attachmentUrl) { this.attachmentUrl = attachmentUrl; }
  public String getAttachmentName() { return attachmentName; }
  public void setAttachmentName(String attachmentName) { this.attachmentName = attachmentName; }
  public String getAttachmentType() { return attachmentType; }
  public void setAttachmentType(String attachmentType) { this.attachmentType = attachmentType; }
  public List<Attachment> getAttachments() { return attachments; }
  public void setAttachments(List<Attachment> attachments) {
    this.attachments = attachments == null ? new ArrayList<>() : attachments;
  }

  public static class Attachment {
    private String id;
    private String url;
    private String name;
    private String type;
    private long size;

    public Attachment() {}

    public Attachment(String id, String url, String name, String type, long size) {
      this.id = id;
      this.url = url;
      this.name = name;
      this.type = type;
      this.size = size;
    }

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getUrl() { return url; }
    public void setUrl(String url) { this.url = url; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public long getSize() { return size; }
    public void setSize(long size) { this.size = size; }
  }
}
