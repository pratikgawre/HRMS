package com.kavya.hrms.model;

import com.fasterxml.jackson.annotation.JsonAlias;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "assets")
public class Asset {
  @Id
  private String id;
  private String assetCode;
  private String assetName;
  private String category;
  private String brand;
  private String model;
  private String serialNo;
  private String purchaseDate;
  @JsonAlias({"current_date", "assignedDate", "assigned_date", "assignmentDate", "assignment_date"})
  private String currentDate;
  @JsonAlias({"due_date", "returnDate", "return_date"})
  private String dueDate;
  @JsonAlias({"assigned_date"})
  private String assignedDate;
  @JsonAlias({"assignment_date"})
  private String assignmentDate;
  @JsonAlias({"return_date"})
  private String returnDate;
  private String status;
  private String assignedToEmployeeId;

  private String assignedTo;

  @Transient
  private String employeeName;


  private String condition;
  private String location;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getAssetCode() { return assetCode; }
  public void setAssetCode(String assetCode) { this.assetCode = assetCode; }
  public String getAssetName() { return assetName; }
  public void setAssetName(String assetName) { this.assetName = assetName; }
  public String getCategory() { return category; }
  public void setCategory(String category) { this.category = category; }
  public String getBrand() { return brand; }
  public void setBrand(String brand) { this.brand = brand; }
  public String getModel() { return model; }
  public void setModel(String model) { this.model = model; }
  public String getSerialNo() { return serialNo; }
  public void setSerialNo(String serialNo) { this.serialNo = serialNo; }
  public String getPurchaseDate() { return purchaseDate; }
  public void setPurchaseDate(String purchaseDate) { this.purchaseDate = purchaseDate; }
  public String getCurrentDate() { return currentDate; }
  public void setCurrentDate(String currentDate) { this.currentDate = currentDate; }
  public String getDueDate() { return dueDate; }
  public void setDueDate(String dueDate) { this.dueDate = dueDate; }
  public String getAssignedDate() { return assignedDate; }
  public void setAssignedDate(String assignedDate) { this.assignedDate = assignedDate; }
  public String getAssignmentDate() { return assignmentDate; }
  public void setAssignmentDate(String assignmentDate) { this.assignmentDate = assignmentDate; }
  public String getReturnDate() { return returnDate; }
  public void setReturnDate(String returnDate) { this.returnDate = returnDate; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getAssignedToEmployeeId() { return assignedToEmployeeId; }
  public void setAssignedToEmployeeId(String assignedToEmployeeId) { this.assignedToEmployeeId = assignedToEmployeeId; }

  public String getAssignedTo() { return assignedTo; }
  public void setAssignedTo(String assignedTo) { this.assignedTo = assignedTo; }

  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }

  public String getCondition() { return condition; }
  public void setCondition(String condition) { this.condition = condition; }
  public String getLocation() { return location; }
  public void setLocation(String location) { this.location = location; }
}
