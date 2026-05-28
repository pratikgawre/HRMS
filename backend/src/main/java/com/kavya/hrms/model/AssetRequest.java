package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "asset_requests")
public class AssetRequest {
  @Id
  private String id;
  private String employeeId;
  private String employeeName;
  private String assetId;
  private String assetCode;
  private String assetName;
  private String requestType;
  private String description;
  private String screenshot;
  private String status;
  private String createdDate;
  private String resolution;
  private String handledBy;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getAssetId() { return assetId; }
  public void setAssetId(String assetId) { this.assetId = assetId; }
  public String getAssetCode() { return assetCode; }
  public void setAssetCode(String assetCode) { this.assetCode = assetCode; }
  public String getAssetName() { return assetName; }
  public void setAssetName(String assetName) { this.assetName = assetName; }
  public String getRequestType() { return requestType; }
  public void setRequestType(String requestType) { this.requestType = requestType; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public String getScreenshot() { return screenshot; }
  public void setScreenshot(String screenshot) { this.screenshot = screenshot; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getCreatedDate() { return createdDate; }
  public void setCreatedDate(String createdDate) { this.createdDate = createdDate; }
  public String getResolution() { return resolution; }
  public void setResolution(String resolution) { this.resolution = resolution; }
  public String getHandledBy() { return handledBy; }
  public void setHandledBy(String handledBy) { this.handledBy = handledBy; }
}
