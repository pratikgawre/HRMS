package com.kavya.hrms.controller;

import com.kavya.hrms.model.PayrollRecord;
import com.kavya.hrms.repository.PayrollRecordRepository;
import com.kavya.hrms.service.PayrollValidationService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {
  private static final String CURRENT_MONTH_LIMIT_MESSAGE =
      "Current month salary can only be marked as paid between the 1st and 15th.";
  private static final String PAYSLIP_LIMIT_MESSAGE =
      "Payslip is available only after the salary is marked as paid.";
  private static final String NOT_FOUND_MESSAGE = "Salary record not found";

  private final PayrollRecordRepository payrollRecordRepository;
  private final PayrollValidationService payrollValidationService;

  public PayrollController(
      PayrollRecordRepository payrollRecordRepository,
      PayrollValidationService payrollValidationService) {
    this.payrollRecordRepository = payrollRecordRepository;
    this.payrollValidationService = payrollValidationService;
  }

  @GetMapping
  public List<PayrollRecord> list() {
    return payrollRecordRepository.findAll();
  }

  @GetMapping("/employee/{employeeId}")
  public List<PayrollRecord> byEmployee(@PathVariable String employeeId) {
    return payrollRecordRepository.findByEmployeeId(employeeId);
  }

  @GetMapping(value = "/employee/{employeeId}", params = {"month", "year"})
  public ResponseEntity<Object> byEmployeeAndPeriod(
      @PathVariable String employeeId,
      @RequestParam String month,
      @RequestParam String year) {
    return payrollRecordRepository.findByEmployeeIdAndMonthAndYear(employeeId, month, year).stream()
        .findFirst()
        .map(record -> ResponseEntity.<Object>ok(record))
        .orElseGet(() -> notFound("Salary record not found for the selected month and year."));
  }

  @GetMapping("/{month}/{year}")
  public List<PayrollRecord> byPeriod(@PathVariable String month, @PathVariable String year) {
    return payrollRecordRepository.findByMonthAndYear(month, year);
  }

  @PostMapping
  public PayrollRecord save(@RequestBody PayrollRecord record) {
    return payrollRecordRepository.save(record);
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
    return payrollRecordRepository.findById(payrollId)
        .map(this::updatePaidStatus)
        .orElseGet(() -> notFound(NOT_FOUND_MESSAGE));
  }

  @GetMapping("/payslip")
  public ResponseEntity<Object> payslip(
      @RequestParam String employeeId,
      @RequestParam String month,
      @RequestParam String year) {
    return payrollRecordRepository.findByEmployeeIdAndMonthAndYear(employeeId, month, year).stream()
        .findFirst()
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
    payrollRecordRepository.deleteAll();
    return payrollRecordRepository.saveAll(records);
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

  private ResponseEntity<Object> updatePaidStatus(PayrollRecord record) {
    if (payrollValidationService.isPaidStatus(record.getStatus())) {
      return badRequest("Salary record has already been marked as paid.");
    }

    if (payrollValidationService.isCurrentMonthUnpaidAfterCutoff(record, LocalDate.now())) {
      return forbidden(CURRENT_MONTH_LIMIT_MESSAGE);
    }

    record.setStatus("PAID");
    record.setPaidDate(Instant.now().toString());
    return ResponseEntity.<Object>ok(payrollRecordRepository.save(record));
  }
}
