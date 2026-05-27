package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "leave_requests")
public class LeaveRequest {
  @Id
  private String id;
  private String employee;
  private String type;
  private String fromDate;
  private String toDate;
  private Integer days;
  private String status;
  private String reason;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEmployee() { return employee; }
  public void setEmployee(String employee) { this.employee = employee; }
  public String getType() { return type; }
  public void setType(String type) { this.type = type; }
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
}
