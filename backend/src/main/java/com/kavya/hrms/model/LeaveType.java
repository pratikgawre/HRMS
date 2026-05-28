package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "leave_types")
public class LeaveType {
  @Id
  private String id;
  private String name;
  private Integer annualQuota;
  private Boolean paidStatus;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public Integer getAnnualQuota() { return annualQuota; }
  public void setAnnualQuota(Integer annualQuota) { this.annualQuota = annualQuota; }
  public Boolean getPaidStatus() { return paidStatus; }
  public void setPaidStatus(Boolean paidStatus) { this.paidStatus = paidStatus; }
}
