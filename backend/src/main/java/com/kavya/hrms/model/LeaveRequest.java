package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "leave_requests")
public class LeaveRequest {
  @Id
  private String id;
  private String employee;
  private String employeeId;
  private String type;
  private String leaveType;
  private String fromDate;
  private String toDate;
  private Integer days;
  private String status;
  private String reason;
  private String recommendationStatus;
  private String recommendedBy;
  private String recommendedRole;
  private String recommendationNote;
  private String finalActionBy;
  private String finalActionRole;
  private String finalActionNote;
  private String approvedBy;
  private String ownerRole;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEmployee() { return employee; }
  public void setEmployee(String employee) { this.employee = employee; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
  public String getLeaveType() { return leaveType; }
  public void setLeaveType(String leaveType) { this.leaveType = leaveType; }
  public String getFromDate() { return fromDate; }
  public void setFromDate(String fromDate) { this.fromDate = fromDate; }
  public String getToDate() { return toDate; }
  public void setToDate(String toDate) { this.toDate = toDate; }
  public Integer getDays() { return days; }
  public void setDays(Integer days) { this.days = days; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getReason() { return reason; }
  public void setReason(String reason) { this.reason = reason; }
  public String getRecommendationStatus() { return recommendationStatus; }
  public void setRecommendationStatus(String recommendationStatus) { this.recommendationStatus = recommendationStatus; }
  public String getRecommendedBy() { return recommendedBy; }
  public void setRecommendedBy(String recommendedBy) { this.recommendedBy = recommendedBy; }
  public String getRecommendedRole() { return recommendedRole; }
  public void setRecommendedRole(String recommendedRole) { this.recommendedRole = recommendedRole; }
  public String getRecommendationNote() { return recommendationNote; }
  public void setRecommendationNote(String recommendationNote) { this.recommendationNote = recommendationNote; }
  public String getFinalActionBy() { return finalActionBy; }
  public void setFinalActionBy(String finalActionBy) { this.finalActionBy = finalActionBy; }
  public String getFinalActionRole() { return finalActionRole; }
  public void setFinalActionRole(String finalActionRole) { this.finalActionRole = finalActionRole; }
  public String getFinalActionNote() { return finalActionNote; }
  public void setFinalActionNote(String finalActionNote) { this.finalActionNote = finalActionNote; }
  public String getApprovedBy() { return approvedBy; }
  public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
  public String getOwnerRole() { return ownerRole; }
  public void setOwnerRole(String ownerRole) { this.ownerRole = ownerRole; }
}
