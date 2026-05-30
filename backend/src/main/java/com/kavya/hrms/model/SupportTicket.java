package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "support_tickets")
public class SupportTicket {
  @Id
  private String id;
  private String ticketId;
  private String employeeId;
  private String raisedBy;
  private String employeeName;
  private String employeeEmail;
  private String title;
  private String category;
  private String priority;
  private String status;
  private String description;
  private String screenshotDataUrl;
  private String screenshot;
  private String createdDate;
  private String assignedTo;
  private String resolution;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTicketId() { return ticketId; }
  public void setTicketId(String ticketId) { this.ticketId = ticketId; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getRaisedBy() { return raisedBy; }
  public void setRaisedBy(String raisedBy) { this.raisedBy = raisedBy; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getEmployeeEmail() { return employeeEmail; }
  public void setEmployeeEmail(String employeeEmail) { this.employeeEmail = employeeEmail; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }
  public String getPriority() { return priority; }
  public void setPriority(String priority) { this.priority = priority; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public String getScreenshotDataUrl() { return screenshotDataUrl; }
  public void setScreenshotDataUrl(String screenshotDataUrl) { this.screenshotDataUrl = screenshotDataUrl; }
  public String getScreenshot() { return screenshot; }
  public void setScreenshot(String screenshot) { this.screenshot = screenshot; }
  public String getCreatedDate() { return createdDate; }
  public void setCreatedDate(String createdDate) { this.createdDate = createdDate; }
  public String getAssignedTo() { return assignedTo; }
  public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }
  public String getResolution() { return resolution; }
  public void setResolution(String resolution) { this.resolution = resolution; }
}
