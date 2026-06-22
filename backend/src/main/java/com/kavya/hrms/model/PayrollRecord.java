package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "payroll_records")
public class PayrollRecord {
  @Id
  private String id;
  private String employeeId;
  private String employeeName;
  private String role;
  private String ownerRole;
  private String department;
  private String month;
  private String year;
  private double basic;
  private double hra;
  private double allowance;
  private double bonus;
  private double tax;
  private double providentFund;
  private double gratuity;
  private double professionalTax;
  private double absentDeduction;
  private double halfDayDeduction;
  private double otherDeduction;
  private double netSalary;
  private double packageAmount;
  private int daysInMonth;
  private double payableDays;
  private double lopDays;
  private String bankName;
  private String accountNo;
  private String uanNo;
  private String aadhaarNo;
  private String panNo;
  private String location;
  private String status;
  private String paidDate;
  private String attendanceSummary;
  private String deductionSummary;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getEmployeeName() { return employeeName; }
  public void setEmployeeName(String employeeName) { this.employeeName = employeeName; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getOwnerRole() { return ownerRole; }
  public void setOwnerRole(String ownerRole) { this.ownerRole = ownerRole; }
  public String getDepartment() { return department; }
  public void setDepartment(String department) { this.department = department; }
  public String getMonth() { return month; }
  public void setMonth(String month) { this.month = month; }
  public String getYear() { return year; }
  public void setYear(String year) { this.year = year; }
  public double getBasic() { return basic; }
  public void setBasic(double basic) { this.basic = basic; }
  public double getHra() { return hra; }
  public void setHra(double hra) { this.hra = hra; }
  public double getAllowance() { return allowance; }
  public void setAllowance(double allowance) { this.allowance = allowance; }
  public double getBonus() { return bonus; }
  public void setBonus(double bonus) { this.bonus = bonus; }
  public double getTax() { return tax; }
  public void setTax(double tax) { this.tax = tax; }
  public double getProvidentFund() { return providentFund; }
  public void setProvidentFund(double providentFund) { this.providentFund = providentFund; }
  public double getGratuity() { return gratuity; }
  public void setGratuity(double gratuity) { this.gratuity = gratuity; }
  public double getProfessionalTax() { return professionalTax; }
  public void setProfessionalTax(double professionalTax) { this.professionalTax = professionalTax; }
  public double getAbsentDeduction() { return absentDeduction; }
  public void setAbsentDeduction(double absentDeduction) { this.absentDeduction = absentDeduction; }
  public double getHalfDayDeduction() { return halfDayDeduction; }
  public void setHalfDayDeduction(double halfDayDeduction) { this.halfDayDeduction = halfDayDeduction; }
  public double getOtherDeduction() { return otherDeduction; }
  public void setOtherDeduction(double otherDeduction) { this.otherDeduction = otherDeduction; }
  public double getNetSalary() { return netSalary; }
  public void setNetSalary(double netSalary) { this.netSalary = netSalary; }
  public double getPackageAmount() { return packageAmount; }
  public void setPackageAmount(double packageAmount) { this.packageAmount = packageAmount; }
  public int getDaysInMonth() { return daysInMonth; }
  public void setDaysInMonth(int daysInMonth) { this.daysInMonth = daysInMonth; }
  public double getPayableDays() { return payableDays; }
  public void setPayableDays(double payableDays) { this.payableDays = payableDays; }
  public double getLopDays() { return lopDays; }
  public void setLopDays(double lopDays) { this.lopDays = lopDays; }
  public String getBankName() { return bankName; }
  public void setBankName(String bankName) { this.bankName = bankName; }
  public String getAccountNo() { return accountNo; }
  public void setAccountNo(String accountNo) { this.accountNo = accountNo; }
  public String getUanNo() { return uanNo; }
  public void setUanNo(String uanNo) { this.uanNo = uanNo; }
  public String getAadhaarNo() { return aadhaarNo; }
  public void setAadhaarNo(String aadhaarNo) { this.aadhaarNo = aadhaarNo; }
  public String getPanNo() { return panNo; }
  public void setPanNo(String panNo) { this.panNo = panNo; }
  public String getLocation() { return location; }
  public void setLocation(String location) { this.location = location; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getPaidDate() { return paidDate; }
  public void setPaidDate(String paidDate) { this.paidDate = paidDate; }
  public String getAttendanceSummary() { return attendanceSummary; }
  public void setAttendanceSummary(String attendanceSummary) { this.attendanceSummary = attendanceSummary; }
  public String getDeductionSummary() { return deductionSummary; }
  public void setDeductionSummary(String deductionSummary) { this.deductionSummary = deductionSummary; }
}
