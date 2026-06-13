package com.kavya.hrms.dto;

import java.util.ArrayList;
import java.util.List;

public class EmployeeDashboardSummary {
  private String employeeId;
  private String employeeName;
  private CardMetric attendance;
  private CardMetric leaveBalance;
  private CardMetric tasks;
  private CardMetric assets;
  private CardMetric announcements;

  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public CardMetric getAttendance() { return attendance; }
  public void setAttendance(CardMetric attendance) { this.attendance = attendance; }
  public CardMetric getLeaveBalance() { return leaveBalance; }
  public void setLeaveBalance(CardMetric leaveBalance) { this.leaveBalance = leaveBalance; }
  public CardMetric getTasks() { return tasks; }
  public void setTasks(CardMetric tasks) { this.tasks = tasks; }
  public CardMetric getAssets() { return assets; }
  public void setAssets(CardMetric assets) { this.assets = assets; }
  public CardMetric getAnnouncements() { return announcements; }
  public void setAnnouncements(CardMetric announcements) { this.announcements = announcements; }

  public static class CardMetric {
    private String label;
    private String value;
    private String delta;
    private String tone;
    private String icon;
    private List<String> navigateTo = new ArrayList<>();

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getValue() { return value; }
    public void setValue(String value) { this.value = value; }
    public String getDelta() { return delta; }
    public void setDelta(String delta) { this.delta = delta; }
    public String getTone() { return tone; }
    public void setTone(String tone) { this.tone = tone; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public List<String> getNavigateTo() { return navigateTo; }
    public void setNavigateTo(List<String> navigateTo) { this.navigateTo = navigateTo; }
  }
}
