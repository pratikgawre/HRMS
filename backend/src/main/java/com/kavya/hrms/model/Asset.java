package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
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
  private String status;

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
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
