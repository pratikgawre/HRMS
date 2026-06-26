package com.kavya.hrms.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "asset_assignments")
public class AssetAssignment {
  @Id
  private String id;
  private String assetId;
  private String assetCode;
  private String assetName;
  private String employeeId;
  private String employeeName;
  @JsonAlias({"currentDate", "current_date", "assignmentDate", "assignment_date"})
  private String assignedDate;
  @JsonAlias({"dueDate", "due_date", "returnDate", "return_date"})
  private String dueDate;
  @JsonAlias({"returnDate", "return_date", "dueDate", "due_date"})
  private String returnDate;
  private String condition;
  private String status;
  private String dispatchReason;
  private String dispatchedBy;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getAssetId() { return assetId; }
  public void setAssetId(String assetId) { this.assetId = assetId; }
  public String getAssetCode() { return assetCode; }
  public void setAssetCode(String assetCode) { this.assetCode = assetCode; }
  public String getAssetName() { return assetName; }
  public void setAssetName(String assetName) { this.assetName = assetName; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getAssignedDate() { return assignedDate; }
  public void setAssignedDate(String assignedDate) { this.assignedDate = assignedDate; }
  public String getDueDate() { return dueDate; }
  public void setDueDate(String dueDate) { this.dueDate = dueDate; }
  public String getReturnDate() { return returnDate; }
  public void setReturnDate(String returnDate) { this.returnDate = returnDate; }
  public String getCondition() { return condition; }
  public void setCondition(String condition) { this.condition = condition; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getDispatchReason() { return dispatchReason; }
  public void setDispatchReason(String dispatchReason) { this.dispatchReason = dispatchReason; }
  public String getDispatchedBy() { return dispatchedBy; }
  public void setDispatchedBy(String dispatchedBy) { this.dispatchedBy = dispatchedBy; }
}
