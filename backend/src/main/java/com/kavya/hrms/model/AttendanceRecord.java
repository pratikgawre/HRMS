package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "attendance_records")
public class AttendanceRecord {
  @Id
  private String id;
  private String employeeId;
  private String employeeName;
  private String dateLabel;
  private String date;
  private String checkIn;
  private String checkOut;
  private String checkInAt;
  private String checkOutAt;
  private String workedHours;
  private String totalHours;
  private String status;
  private String remarks;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getDateLabel() { return dateLabel; }
  public void setDateLabel(String dateLabel) { this.dateLabel = dateLabel; }
  public String getDate() { return date; }
  public void setDate(String date) { this.date = date; }
  public String getCheckIn() { return checkIn; }
  public void setCheckIn(String checkIn) { this.checkIn = checkIn; }
  public String getCheckOut() { return checkOut; }
  public void setCheckOut(String checkOut) { this.checkOut = checkOut; }
  public String getCheckInAt() { return checkInAt; }
  public void setCheckInAt(String checkInAt) { this.checkInAt = checkInAt; }
  public String getCheckOutAt() { return checkOutAt; }
  public void setCheckOutAt(String checkOutAt) { this.checkOutAt = checkOutAt; }
  public String getWorkedHours() { return workedHours; }
  public void setWorkedHours(String workedHours) { this.workedHours = workedHours; }
  public String getTotalHours() { return totalHours; }
  public void setTotalHours(String totalHours) { this.totalHours = totalHours; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getRemarks() { return remarks; }
  public void setRemarks(String remarks) { this.remarks = remarks; }
}
