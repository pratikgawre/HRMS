package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "departments")
public class Department {
  @Id
  private String id;
  private String name;
  private String headId;
  private String status;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getHeadId() { return headId; }
  public void setHeadId(String headId) { this.headId = headId; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
