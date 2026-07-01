package com.kavya.hrms.controller;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.kavya.hrms.model.PayrollRecord;
import com.kavya.hrms.repository.PayrollRecordRepository;
import com.kavya.hrms.service.PayrollGenerationService;
import com.kavya.hrms.service.PayrollValidationService;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {
  private static final String CURRENT_MONTH_LIMIT_MESSAGE = "Current month salary can only be marked as paid between the 1st and 15th.";
  private static final String FUTURE_PERIOD_LIMIT_MESSAGE = "Salary payments cannot be processed for future payroll periods.";
  private static final String PAYSLIP_LIMIT_MESSAGE = "Payslip is available only after the salary is marked as paid.";
  private static final String NOT_FOUND_MESSAGE = "Salary record not found";

  private final PayrollRecordRepository payrollRecordRepository;
  private final PayrollValidationService payrollValidationService;
  private final PayrollGenerationService payrollGenerationService;

  public PayrollController(
      PayrollRecordRepository payrollRecordRepository,
      PayrollValidationService payrollValidationService,
      PayrollGenerationService payrollGenerationService) {
    this.payrollRecordRepository = payrollRecordRepository;
    this.payrollValidationService = payrollValidationService;
    this.payrollGenerationService = payrollGenerationService;
  }

  @GetMapping
  public List<PayrollRecord> list() {
    return payrollRecordRepository.findAll();
  }

  @GetMapping("/employee/{employeeId}")
  public List<PayrollRecord> byEmployee(@PathVariable String employeeId) {
    return payrollRecordRepository.findByEmployeeId(employeeId);
  }

  @GetMapping(value = "/employee/{employeeId}", params = { "month", "year" })
  public ResponseEntity<Object> byEmployeeAndPeriod(
      @PathVariable String employeeId,
      @RequestParam String month,
      @RequestParam String year) {
    return selectPreferredPayrollRecord(employeeId, month, year)
        .map(record -> ResponseEntity.<Object>ok(record))
        .orElseGet(() -> notFound("Salary record not found for the selected month and year."));
  }

  @GetMapping("/{month}/{year}")
  public List<PayrollRecord> byPeriod(@PathVariable String month, @PathVariable String year) {
    return payrollRecordRepository.findByMonthAndYear(month, year);
  }

  @PostMapping("/generate")
  public ResponseEntity<Object> generatePayroll(
      @RequestParam String month,
      @RequestParam String year) {
    try {
      return ResponseEntity.<Object>ok(
          payrollGenerationService.generateAndStorePayrollRecords(month, year));
    } catch (IllegalArgumentException ex) {
      return badRequest(ex.getMessage());
    }
  }

  @PostMapping
  public ResponseEntity<Object> save(@RequestBody PayrollRecord record) {
    if (record == null || isBlank(record.getEmployeeId()) || isBlank(record.getMonth()) || isBlank(record.getYear())) {
      return badRequest("Employee, month, and year are required.");
    }

    return payrollRecordRepository
        .findByEmployeeIdAndMonthAndYear(record.getEmployeeId(), record.getMonth(), record.getYear())
        .stream()
        .findFirst()
        .map(existing -> {
          if (existing.getId() != null && !existing.getId().equals(record.getId())) {
            return badRequest("Salary record already exists for the selected employee and period.");
          }
          record.setId(existing.getId());
          return ResponseEntity.<Object>ok(payrollRecordRepository.save(record));
        })
        .orElseGet(() -> ResponseEntity.<Object>ok(payrollRecordRepository.save(record)));
  }

  @PatchMapping("/{payrollId}/mark-paid")
  public ResponseEntity<Object> markPaid(@PathVariable String payrollId) {
    return markPaidInternal(payrollId);
  }

  @PutMapping("/{payrollId}/mark-paid")
  public ResponseEntity<Object> updatePaid(@PathVariable String payrollId) {
    return markPaidInternal(payrollId);
  }

  private ResponseEntity<Object> markPaidInternal(String payrollId) {
    String safePayrollId = payrollId == null ? "" : payrollId;
    return payrollRecordRepository.findById(safePayrollId)
        .map(this::updatePaidStatus)
        .orElseGet(() -> notFound(NOT_FOUND_MESSAGE));
  }

  @GetMapping("/payslip")
  public ResponseEntity<Object> payslip(
      @RequestParam String employeeId,
      @RequestParam String month,
      @RequestParam String year) {
    return selectPreferredPayrollRecord(employeeId, month, year)
        .map(record -> {
          if (!payrollValidationService.canGeneratePayslip(record)) {
            return forbidden(PAYSLIP_LIMIT_MESSAGE);
          }

          return ResponseEntity.<Object>ok(record);
        })
        .orElseGet(() -> notFound("Salary record not found for the selected month and year."));
  }

  @PostMapping("/bulk")
  public List<PayrollRecord> bulkSave(
      @RequestBody List<PayrollRecord> records) {
    List<PayrollRecord> safeRecords = safeList(records);
    return payrollRecordRepository.saveAll(Objects.requireNonNull(safeRecords));
  }

  private ResponseEntity<Object> forbidden(String message) {
    return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", message));
  }

  private ResponseEntity<Object> badRequest(String message) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", message));
  }

  private ResponseEntity<Object> notFound(String message) {
    return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", message));
  }

  private java.util.Optional<PayrollRecord> selectPreferredPayrollRecord(String employeeId, String month, String year) {
    return payrollRecordRepository.findByEmployeeIdAndMonthAndYear(employeeId, month, year).stream()
        .max(Comparator.comparingInt(this::paidRecordPriority));
  }

  private int paidRecordPriority(PayrollRecord record) {
    if (record == null) {
      return 0;
    }

    if (payrollValidationService.isPaidStatus(record.getStatus())) {
      return 2;
    }

    return record.getNetSalary() > 0 ? 1 : 0;
  }

  private ResponseEntity<Object> updatePaidStatus(PayrollRecord record) {
    if (record.getNetSalary() <= 0) {
      return badRequest("Zero salary records cannot be marked as paid.");
    }

    if (payrollValidationService.isPaidStatus(record.getStatus())) {
      return ResponseEntity.<Object>ok(record);
    }

    if (payrollValidationService.isFuturePayrollPeriod(record.getMonth(), record.getYear(), LocalDate.now())) {
      return forbidden(FUTURE_PERIOD_LIMIT_MESSAGE);
    }

    if (payrollValidationService.isCurrentMonthUnpaidAfterCutoff(record, LocalDate.now())) {
      return forbidden(CURRENT_MONTH_LIMIT_MESSAGE);
    }

    record.setStatus("PAID");
    record.setPaidDate(Instant.now().toString());
    return ResponseEntity.<Object>ok(payrollRecordRepository.save(record));
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }

  private <T> List<T> safeList(List<T> values) {
    return values == null ? new java.util.ArrayList<>() : new java.util.ArrayList<>(values);
  }

}



