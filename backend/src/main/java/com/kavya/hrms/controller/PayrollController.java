package com.kavya.hrms.controller;

import com.kavya.hrms.model.PayrollRecord;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.PayrollRecordRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.stream.Collectors;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {
  private final PayrollRecordRepository payrollRecordRepository;
  private final AppUserRepository appUserRepository;
  private final NotificationService notificationService;

  public PayrollController(
      PayrollRecordRepository payrollRecordRepository,
      AppUserRepository appUserRepository,
      NotificationService notificationService) {
    this.payrollRecordRepository = payrollRecordRepository;
    this.appUserRepository = appUserRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<PayrollRecord> list() {
    return payrollRecordRepository.findAll();
  }

  @GetMapping("/employee/{employeeId}")
  public List<PayrollRecord> byEmployee(@PathVariable String employeeId) {
    return payrollRecordRepository.findByEmployeeId(employeeId);
  }

  @GetMapping("/{month}/{year}")
  public List<PayrollRecord> byPeriod(@PathVariable String month, @PathVariable String year) {
    return payrollRecordRepository.findByMonthAndYear(month, year);
  }

  @PostMapping
  public PayrollRecord save(
      @RequestBody PayrollRecord record,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    PayrollRecord saved = payrollRecordRepository.save(record);
    notifyPayrollChange(List.of(saved), "Payslip generated", accessRole, userId, "generated");
    return saved;
  }

  @PostMapping("/bulk")
  public List<PayrollRecord> bulkSave(
      @RequestBody List<PayrollRecord> records,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    long existingCount = payrollRecordRepository.count();
    payrollRecordRepository.deleteAll();
    List<PayrollRecord> saved = payrollRecordRepository.saveAll(records);
    if (existingCount > 0) {
      notifyPayrollChange(saved, "Payroll updated", accessRole, userId, "updated");
    }
    return saved;
  }

  private void notifyPayrollChange(List<PayrollRecord> records, String title, String accessRole, String userId, String verb) {
    Set<String> employeeIds = records.stream()
        .map(PayrollRecord::getEmployeeId)
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    Set<String> employeeUserIds = appUserRepository.findByEmployeeIdIn(employeeIds).stream()
        .map(user -> user.getUserId())
        .filter(value -> value != null && !value.isBlank())
        .collect(Collectors.toCollection(LinkedHashSet::new));

    String message = records.isEmpty()
        ? "Payroll records were " + verb + "."
        : "Payroll for " + records.get(0).getMonth() + " " + records.get(0).getYear() + " was " + verb + ".";

    notificationService.notifyRoles(
        NotificationAudience.payrollRecipients(),
        title,
        message,
        "payroll",
        "bulk",
        accessRole,
        "System",
        userId);
    notificationService.notifyUsers(
        employeeUserIds,
        title,
        message,
        "payroll",
        "bulk",
        accessRole,
        "System");
  }
}
