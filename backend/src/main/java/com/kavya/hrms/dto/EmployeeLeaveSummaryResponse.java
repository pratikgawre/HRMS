package com.kavya.hrms.dto;

public class EmployeeLeaveSummaryResponse {
  private String employeeId;
  private String employeeName;
  private long totalAllotted;
  private long totalTaken;
  private long totalRemaining;

  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public long getTotalAllotted() { return totalAllotted; }
  public void setTotalAllotted(long totalAllotted) { this.totalAllotted = totalAllotted; }
  public long getTotalTaken() { return totalTaken; }
  public void setTotalTaken(long totalTaken) { this.totalTaken = totalTaken; }
  public long getTotalRemaining() { return totalRemaining; }
  public void setTotalRemaining(long totalRemaining) { this.totalRemaining = totalRemaining; }
}
