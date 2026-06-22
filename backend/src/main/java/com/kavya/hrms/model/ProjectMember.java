package com.kavya.hrms.model;

public class ProjectMember {
  private String id;
  private String employeeCode;
  private String name;
  private String displayName;
  private String department;
  private String role;
  private String avatar;
  private String status;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEmployeeCode() { return employeeCode; }
  public void setEmployeeCode(String employeeCode) { this.employeeCode = employeeCode; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getDisplayName() { return displayName; }
  public void setDisplayName(String displayName) { this.displayName = displayName; }
  public String getDepartment() { return department; }
  public void setDepartment(String department) { this.department = department; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getAvatar() { return avatar; }
  public void setAvatar(String avatar) { this.avatar = avatar; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}
