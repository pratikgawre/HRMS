package com.kavya.hrms.service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.model.PayrollRecord;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.LeaveRequestRepository;
import com.kavya.hrms.repository.PayrollRecordRepository;

@Service
@SuppressWarnings("all")
public class PayrollGenerationService {
  private static final String[] MONTHS = {
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
  };

  private final EmployeeRepository employeeRepository;
  private final AttendanceRecordRepository attendanceRecordRepository;
  private final LeaveRequestRepository leaveRequestRepository;
  private final PayrollRecordRepository payrollRecordRepository;
  private final PayrollValidationService payrollValidationService;

  public PayrollGenerationService(
      EmployeeRepository employeeRepository,
      AttendanceRecordRepository attendanceRecordRepository,
      LeaveRequestRepository leaveRequestRepository,
      PayrollRecordRepository payrollRecordRepository,
      PayrollValidationService payrollValidationService) {
    this.employeeRepository = employeeRepository;
    this.attendanceRecordRepository = attendanceRecordRepository;
    this.leaveRequestRepository = leaveRequestRepository;
    this.payrollRecordRepository = payrollRecordRepository;
    this.payrollValidationService = payrollValidationService;
  }

  public List<PayrollRecord> generateAndStorePayrollRecords(String month, String year) {
    int monthIndex = normalizeMonthIndexOrThrow(month);
    int targetYear = parseYearOrThrow(year);
    String normalizedMonth = MONTHS[monthIndex];
    String normalizedYear = String.valueOf(targetYear);

    List<Employee> employees = employeeRepository.findAll();
    List<AttendanceRecord> attendanceRecords = attendanceRecordRepository.findAll();
    List<LeaveRequest> leaveRequests = leaveRequestRepository.findAll();
    Map<String, PayrollRecord> existingRecords = payrollRecordRepository.findByMonthAndYear(normalizedMonth, normalizedYear).stream()
        .filter(record -> record.getEmployeeId() != null && !record.getEmployeeId().isBlank())
        .collect(Collectors.toMap(
            record -> record.getEmployeeId(),
            record -> record,
            (left, right) -> right,
            HashMap::new));

    List<PayrollRecord> generatedRecords = new ArrayList<>();
    for (Employee employee : employees) {
      if (employee == null) {
        continue;
      }

      PayrollRecord record = buildPayrollRecord(employee, attendanceRecords, leaveRequests, monthIndex, targetYear,
          existingRecords.get(resolveEmployeeId(employee)));
      if (record != null) {
        generatedRecords.add(record);
      }
    }

    payrollRecordRepository.deleteByMonthAndYear(normalizedMonth, normalizedYear);
    if (generatedRecords.isEmpty()) {
      return List.of();
    }

    return payrollRecordRepository.saveAll(new ArrayList<>(generatedRecords));
  }

  @Nullable
  private PayrollRecord buildPayrollRecord(
      Employee employee,
      List<AttendanceRecord> attendanceRecords,
      List<LeaveRequest> leaveRequests,
      int monthIndex,
      int year,
      PayrollRecord existingRecord) {
    if (employee == null || "inactive".equalsIgnoreCase(String.valueOf(employee.getStatus()))) {
      return null;
    }

    String employeeId = resolveEmployeeId(employee);
    if (employeeId.isBlank()) {
      return null;
    }

    AttendanceSummary summary = summarizeAttendance(attendanceRecords, employeeId, monthIndex, year);
    double packageAmount = parseCurrencyNumber(employee.getPackageAmount());
    double monthlyGross = getMonthlyGrossFromPackage(packageAmount);
    double approvedLeaveDays = getApprovedLeaveDaysForPeriod(leaveRequests, employeeId, monthIndex, year,
        summary.attendanceDateKeys);
    double paidLeaveDays = summary.leaveDays + approvedLeaveDays;
    int daysInMonth = YearMonth.of(year, monthIndex + 1).lengthOfMonth();
    double perDaySalary = monthlyGross / Math.max(daysInMonth, 1);
    boolean hasAttendance = summary.presentDays > 0 || summary.halfDays > 0 || summary.leaveDays > 0
        || approvedLeaveDays > 0;
    double absentDeduction = hasAttendance ? roundMoney(summary.absentDays * perDaySalary) : 0;
    double halfDayDeduction = hasAttendance ? roundMoney(summary.halfDays * perDaySalary * 0.5) : 0;
    double providentFund = hasAttendance ? getProvidentFund(monthlyGross, employee) : 0;
    double gratuity = hasAttendance ? getGratuity(monthlyGross) : 0;
    double professionalTax = hasAttendance ? getProfessionalTax(monthlyGross) : 0;
    double otherDeduction = 0;
    double totalEarnings = hasAttendance ? monthlyGross : 0;
    double totalDeductions = absentDeduction + halfDayDeduction + providentFund + gratuity + professionalTax
        + otherDeduction;
    double netSalary = roundMoney(totalEarnings - totalDeductions);
    String monthName = MONTHS[monthIndex];
    String id = getPayrollRecordId(employeeId, monthName, String.valueOf(year));

    PayrollRecord record = new PayrollRecord();
    record.setId(id);
    record.setEmployeeId(employeeId);
    record.setEmployeeName(
        firstNonBlank(employee.getDisplayName(), employee.getName(), buildEmployeeName(employee), "Employee"));
    record.setRole(firstNonBlank(employee.getJobTitle(), employee.getRole(), "Employee"));
    record.setOwnerRole(firstNonBlank(employee.getAccessRole(), "employee"));
    record.setDepartment(firstNonBlank(employee.getDepartment(), "-"));
    record.setMonth(monthName);
    record.setYear(String.valueOf(year));
    record.setBasic(roundMoney(totalEarnings));
    record.setHra(0);
    record.setAllowance(0);
    record.setBonus(0);
    record.setTax(0);
    record.setProvidentFund(providentFund);
    record.setGratuity(gratuity);
    record.setProfessionalTax(professionalTax);
    record.setAbsentDeduction(absentDeduction);
    record.setHalfDayDeduction(halfDayDeduction);
    record.setOtherDeduction(otherDeduction);
    record.setNetSalary(netSalary);
    record.setPackageAmount(roundMoney(packageAmount));
    record.setDaysInMonth(daysInMonth);
    record
        .setPayableDays(hasAttendance ? roundMoney(summary.presentDays + (summary.halfDays * 0.5) + paidLeaveDays) : 0);
    record.setLopDays(hasAttendance ? roundMoney(summary.absentDays + (summary.halfDays * 0.5)) : daysInMonth);
    record.setAccountNo(firstNonBlank(employee.getAccountNo(), "-"));
    record.setUanNo(firstNonBlank(employee.getPfUanNo(), "-"));
    record.setAadhaarNo(firstNonBlank(employee.getAadhaarCardNo(), "-"));
    record.setPanNo(firstNonBlank(employee.getPanCardNo(), "-"));
    record.setLocation(firstNonBlank(employee.getWorkingLocation(), employee.getPresentCityDistrict(),
        employee.getPermanentCityDistrict(), "-"));
    record.setStatus(
        netSalary > 0 && existingRecord != null && payrollValidationService.isPaidStatus(existingRecord.getStatus())
            ? existingRecord.getStatus()
            : "Unpaid");
    record.setPaidDate(
        netSalary > 0 && existingRecord != null && payrollValidationService.isPaidStatus(existingRecord.getStatus())
            ? existingRecord.getPaidDate()
            : null);
    record.setAttendanceSummary(summary.presentDays + " present, "
        + paidLeaveDays + " approved leave, "
        + summary.halfDays + " half day, "
        + summary.absentDays + " absent");
    record.setDeductionSummary("PF " + roundMoney(providentFund)
        + ", Gratuity " + roundMoney(gratuity)
        + ", Prof Tax " + roundMoney(professionalTax)
        + ", LOP " + roundMoney(absentDeduction + halfDayDeduction));
    return record;
  }

  private AttendanceSummary summarizeAttendance(List<AttendanceRecord> attendanceRecords, String employeeId,
      int monthIndex, int year) {
    AttendanceSummary summary = new AttendanceSummary();

    for (AttendanceRecord record : attendanceRecords) {
      LocalDate date = parseAttendanceDate(record);
      if (date == null || date.getMonthValue() - 1 != monthIndex || date.getYear() != year) {
        continue;
      }

      if (!employeeId.equals(String.valueOf(record.getEmployeeId()).trim())) {
        continue;
      }

      String status = String.valueOf(record.getStatus() == null ? "" : record.getStatus()).trim()
          .toLowerCase(Locale.ENGLISH);
      if (status.equals("absent")) {
        summary.absentDays += 1;
      } else if (status.equals("half day")) {
        summary.halfDays += 1;
      } else if (status.contains("leave")) {
        summary.leaveDays += 1;
      } else {
        summary.presentDays += 1;
      }

      summary.attendanceDateKeys.add(getAttendanceDateKey(date));
    }

    return summary;
  }

  private double getApprovedLeaveDaysForPeriod(
      List<LeaveRequest> leaveRequests,
      String employeeId,
      int monthIndex,
      int year,
      Set<String> attendanceDateKeys) {
    double total = 0;

    for (LeaveRequest request : leaveRequests) {
      if (!isApprovedLeaveRequest(request) || !matchesEmployeeId(request, employeeId)) {
        continue;
      }

      LocalDate start = parseFlexibleDate(request.getFromDate(), year);
      LocalDate end = parseFlexibleDate(request.getToDate(), year);
      if (start == null && end == null) {
        total += normalizeDays(request.getDays());
        continue;
      }

      LocalDate rangeStart = start != null ? start : end;
      LocalDate rangeEnd = end != null ? end : rangeStart;
      if (rangeStart == null || rangeEnd == null) {
        continue;
      }

      LocalDate monthStart = LocalDate.of(year, monthIndex + 1, 1);
      LocalDate monthEnd = YearMonth.of(year, monthIndex + 1).atEndOfMonth();
      if (rangeEnd.isBefore(monthStart) || rangeStart.isAfter(monthEnd)) {
        continue;
      }

      int coveredDays = 0;
      LocalDate cursor = rangeStart;
      while (!cursor.isAfter(rangeEnd)) {
        if (cursor.getYear() == year && cursor.getMonthValue() - 1 == monthIndex
            && !attendanceDateKeys.contains(getAttendanceDateKey(cursor))) {
          coveredDays += 1;
        }
        cursor = cursor.plusDays(1);
      }

      if (coveredDays > 0) {
        total += coveredDays;
      } else {
        total += normalizeDays(request.getDays() != null ? request.getDays() : getDateSpanDays(rangeStart, rangeEnd));
      }
    }

    return total;
  }

  private boolean isApprovedLeaveRequest(LeaveRequest request) {
    return request != null && "approved".equalsIgnoreCase(String.valueOf(request.getStatus()).trim());
  }

  private boolean matchesEmployeeId(LeaveRequest request, String employeeId) {
    if (request == null) {
      return false;
    }

    String requestEmployeeId = firstNonBlank(request.getEmployeeId(), "");
    return !employeeId.isBlank() && employeeId.equals(requestEmployeeId.trim());
  }

  @Nullable
  private LocalDate parseAttendanceDate(AttendanceRecord record) {
    if (record == null) {
      return null;
    }

    LocalDate parsed = parseFlexibleDate(record.getDate(), null);
    if (parsed != null) {
      return parsed;
    }

    return parseFlexibleDate(record.getDateLabel(), null);
  }

  @Nullable
  private LocalDate parseFlexibleDate(String value, Integer fallbackYear) {
    if (value == null || value.isBlank()) {
      return null;
    }

    String text = value.trim();
    try {
      return LocalDate.parse(text);
    } catch (DateTimeParseException ignored) {
      // Fall through to other formats.
    }

    String normalized = text.replaceAll(",", "");
    String[] patterns = { "d MMM uuuu", "d MMM yyyy", "d MMM" };
    for (String pattern : patterns) {
      try {
        if ("d MMM".equals(pattern)) {
          if (fallbackYear == null) {
            continue;
          }
          String candidate = normalized + " " + fallbackYear;
          return LocalDate.parse(candidate, java.time.format.DateTimeFormatter.ofPattern("d MMM uuuu", Locale.ENGLISH));
        }
        return LocalDate.parse(normalized, java.time.format.DateTimeFormatter.ofPattern(pattern, Locale.ENGLISH));
      } catch (DateTimeParseException ignored) {
        // Continue.
      }
    }

    return null;
  }

  private double getMonthlyGrossFromPackage(double packageAmount) {
    if (packageAmount >= 300000) {
      return roundMoney(packageAmount / 12.0);
    }

    return roundMoney(packageAmount);
  }

  private double parseCurrencyNumber(String value) {
    String normalized = value == null ? "" : value.replaceAll(",", "").replaceAll("[^\\d.]", "");
    if (normalized.isBlank()) {
      return 0;
    }

    try {
      return Double.parseDouble(normalized);
    } catch (NumberFormatException ex) {
      return 0;
    }
  }

  private double getProvidentFund(double monthlyGross, Employee employee) {
    if (employee == null || employee.getPfUanNo() == null || employee.getPfUanNo().isBlank()) {
      return 0;
    }

    return roundMoney((monthlyGross * 0.5) * 0.12);
  }

  private double getGratuity(double monthlyGross) {
    return roundMoney((monthlyGross * 0.5) * (15.0 / 26.0 / 12.0));
  }

  private double getProfessionalTax(double monthlyGross) {
    return monthlyGross > 0 ? 200 : 0;
  }

  private double roundMoney(double value) {
    return Math.round(value * 100.0) / 100.0;
  }

  private double normalizeDays(Integer value) {
    return value != null && value > 0 ? value.doubleValue() : 0;
  }

  private int getDateSpanDays(LocalDate start, LocalDate end) {
    if (start == null || end == null) {
      return 0;
    }

    return (int) (end.toEpochDay() - start.toEpochDay()) + 1;
  }

  private int normalizeMonthIndexOrThrow(String month) {
    Integer monthIndex = payrollValidationService.normalizeMonthIndex(month);
    if (monthIndex == null || monthIndex < 0 || monthIndex > 11) {
      throw new IllegalArgumentException("Invalid payroll month.");
    }
    return monthIndex;
  }

  private int parseYearOrThrow(String year) {
    try {
      return Integer.parseInt(String.valueOf(year).trim());
    } catch (Exception ex) {
      throw new IllegalArgumentException("Invalid payroll year.");
    }
  }

  private String getPayrollRecordId(String employeeId, String month, String year) {
    return "PAY-" + employeeId + "-" + month + "-" + year;
  }

  private String getAttendanceDateKey(LocalDate date) {
    if (date == null) {
      return "";
    }

    return date.toString();
  }

  private String resolveEmployeeId(Employee employee) {
    if (employee == null) {
      return "";
    }

    return firstNonBlank(employee.getEmployeeCode(), employee.getEmployeeId(), employee.getId(), "").trim();
  }

  private String buildEmployeeName(Employee employee) {
    if (employee == null) {
      return "Employee";
    }

    String firstName = firstNonBlank(employee.getFirstName(), "");
    String lastName = firstNonBlank(employee.getLastName(), "");
    String fullName = (firstName + " " + lastName).trim();
    if (!fullName.isBlank()) {
      return fullName;
    }

    return firstNonBlank(employee.getDisplayName(), employee.getName(), "Employee");
  }

  private String firstNonBlank(String... values) {
    for (String value : values) {
      if (value != null) {
        String trimmed = value.trim();
        if (!trimmed.isBlank()) {
          return trimmed;
        }
      }
    }
    return "";
  }

  private static final class AttendanceSummary {
    private int presentDays;
    private int halfDays;
    private int absentDays;
    private int leaveDays;
    private final Set<String> attendanceDateKeys = new HashSet<>();
  }
}
