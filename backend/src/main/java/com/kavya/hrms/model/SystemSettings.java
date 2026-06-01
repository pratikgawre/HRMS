package com.kavya.hrms.model;

import java.util.List;
import java.util.Map;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "system_settings")
public class SystemSettings {
  @Id
  private String id;
  private String companyName;
  private String timezone;
  private String workingHours;
  private String weekOff;
  private String payrollCutoff;
  private List<String> departments;
  private List<String> designations;
  private List<LeaveTypeSetting> leaveTypes;
  private Map<String, List<String>> permissionMatrix;
  private Map<String, String> payrollSettings;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getCompanyName() { return companyName; }
  public void setCompanyName(String companyName) { this.companyName = companyName; }
  public String getTimezone() { return timezone; }
  public void setTimezone(String timezone) { this.timezone = timezone; }
  public String getWorkingHours() { return workingHours; }
  public void setWorkingHours(String workingHours) { this.workingHours = workingHours; }
  public String getWeekOff() { return weekOff; }
  public void setWeekOff(String weekOff) { this.weekOff = weekOff; }
  public String getPayrollCutoff() { return payrollCutoff; }
  public void setPayrollCutoff(String payrollCutoff) { this.payrollCutoff = payrollCutoff; }
  public List<String> getDepartments() { return departments; }
  public void setDepartments(List<String> departments) { this.departments = departments; }
  public List<String> getDesignations() { return designations; }
  public void setDesignations(List<String> designations) { this.designations = designations; }
  public List<LeaveTypeSetting> getLeaveTypes() { return leaveTypes; }
  public void setLeaveTypes(List<LeaveTypeSetting> leaveTypes) { this.leaveTypes = leaveTypes; }
  public Map<String, List<String>> getPermissionMatrix() { return permissionMatrix; }
  public void setPermissionMatrix(Map<String, List<String>> permissionMatrix) { this.permissionMatrix = permissionMatrix; }
  public Map<String, String> getPayrollSettings() { return payrollSettings; }
  public void setPayrollSettings(Map<String, String> payrollSettings) { this.payrollSettings = payrollSettings; }

  public static class LeaveTypeSetting {
    private String name;
    private Integer days;

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public Integer getDays() { return days; }
    public void setDays(Integer days) { this.days = days; }
  }
}
