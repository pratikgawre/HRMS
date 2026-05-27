package com.kavya.hrms.dto;

public class AdminDashboardSummary {
  private long totalEmployees;
  private long pendingLeaves;
  private long openRoles;
  private long presentToday;

  public long getTotalEmployees() { return totalEmployees; }
  public void setTotalEmployees(long totalEmployees) { this.totalEmployees = totalEmployees; }
  public long getPendingLeaves() { return pendingLeaves; }
  public void setPendingLeaves(long pendingLeaves) { this.pendingLeaves = pendingLeaves; }
  public long getOpenRoles() { return openRoles; }
  public void setOpenRoles(long openRoles) { this.openRoles = openRoles; }
  public long getPresentToday() { return presentToday; }
  public void setPresentToday(long presentToday) { this.presentToday = presentToday; }
}
