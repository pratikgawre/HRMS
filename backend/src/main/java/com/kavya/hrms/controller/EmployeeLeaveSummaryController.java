package com.kavya.hrms.controller;

import com.kavya.hrms.dto.EmployeeLeaveSummaryResponse;
import com.kavya.hrms.service.EmployeeLeaveSummaryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leaves")
public class EmployeeLeaveSummaryController {
  private final EmployeeLeaveSummaryService employeeLeaveSummaryService;

  public EmployeeLeaveSummaryController(EmployeeLeaveSummaryService employeeLeaveSummaryService) {
    this.employeeLeaveSummaryService = employeeLeaveSummaryService;
  }

  @GetMapping("/summary/current")
  public EmployeeLeaveSummaryResponse currentSummary(
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId,
      @RequestHeader(value = "X-Kavya-Employee-Id", required = false) String employeeId) {
    return employeeLeaveSummaryService.getCurrentEmployeeSummary(userId, employeeId);
  }
}
