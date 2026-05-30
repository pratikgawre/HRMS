package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "designations")
public class Designation {
  @Id
  private String id;
  private String title;
  private String departmentId;
  private String level;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getDepartmentId() { return departmentId; }
  public void setDepartmentId(String departmentId) { this.departmentId = departmentId; }
  public String getLevel() { return level; }
  public void setLevel(String level) { this.level = level; }
}
