package com.kavya.hrms.dto;

public class MonthlyAttendanceSummary {
  private String employeeId;
  private String employeeName;
  private String month;
  private int year;
  private int totalWorkingDays;
  private int presentDays;
  private int halfDays;
  private int absentDays;
  private int leaveDays;
  private int recordCount;
  private double workedDays;
  private double attendancePercentage;

  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getMonth() { return month; }
  public void setMonth(String month) { this.month = month; }
  public int getYear() { return year; }
  public void setYear(int year) { this.year = year; }
  public int getTotalWorkingDays() { return totalWorkingDays; }
  public void setTotalWorkingDays(int totalWorkingDays) { this.totalWorkingDays = totalWorkingDays; }
  public int getPresentDays() { return presentDays; }
  public void setPresentDays(int presentDays) { this.presentDays = presentDays; }
  public int getHalfDays() { return halfDays; }
  public void setHalfDays(int halfDays) { this.halfDays = halfDays; }
  public int getAbsentDays() { return absentDays; }
  public void setAbsentDays(int absentDays) { this.absentDays = absentDays; }
  public int getLeaveDays() { return leaveDays; }
  public void setLeaveDays(int leaveDays) { this.leaveDays = leaveDays; }
  public int getRecordCount() { return recordCount; }
  public void setRecordCount(int recordCount) { this.recordCount = recordCount; }
  public double getWorkedDays() { return workedDays; }
  public void setWorkedDays(double workedDays) { this.workedDays = workedDays; }
  public double getAttendancePercentage() { return attendancePercentage; }
  public void setAttendancePercentage(double attendancePercentage) { this.attendancePercentage = attendancePercentage; }
}
