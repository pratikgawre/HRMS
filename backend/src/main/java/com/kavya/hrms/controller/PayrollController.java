package com.kavya.hrms.controller;

import com.kavya.hrms.model.PayrollRecord;
import com.kavya.hrms.repository.PayrollRecordRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {
  private final PayrollRecordRepository payrollRecordRepository;

  public PayrollController(PayrollRecordRepository payrollRecordRepository) {
    this.payrollRecordRepository = payrollRecordRepository;
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
  public PayrollRecord save(@RequestBody PayrollRecord record) {
    return payrollRecordRepository.save(record);
  }

  @PostMapping("/bulk")
  public List<PayrollRecord> bulkSave(
      @RequestBody List<PayrollRecord> records) {
    payrollRecordRepository.deleteAll();
    return payrollRecordRepository.saveAll(records);
  }
}
