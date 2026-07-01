package com.kavya.hrms.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class PayrollValidationServiceTest {
  private final PayrollValidationService service = new PayrollValidationService();

  @Test
  void locksCurrentMonthAfterCutoff() {
    assertFalse(service.isMarkPaidDisabled("June", "2026", "Unpaid", LocalDate.of(2026, 6, 1)));
    assertFalse(service.isMarkPaidDisabled("6", "2026", "Unpaid", LocalDate.of(2026, 6, 15)));
    assertTrue(service.isMarkPaidDisabled("June", "2026", "Unpaid", LocalDate.of(2026, 6, 16)));
    assertTrue(service.isMarkPaidDisabled("June", "2026", "Unpaid", LocalDate.of(2026, 6, 30)));
    assertTrue(service.isMarkPaidDisabled("June", "2026", "Paid", LocalDate.of(2026, 6, 30)));
  }

  @Test
  void keepsPreviousMonthsEnabled() {
    assertFalse(service.isMarkPaidDisabled("May", "2026", "Unpaid", LocalDate.of(2026, 7, 1)));
    assertFalse(service.isMarkPaidDisabled("December", "2025", "Unpaid", LocalDate.of(2026, 7, 15)));
    assertFalse(service.isMarkPaidDisabled("May", "2026", "Unpaid", LocalDate.of(2026, 6, 16)));
    assertFalse(service.isMarkPaidDisabled("June", "2025", "Unpaid", LocalDate.of(2026, 6, 16)));
  }

  @Test
  void blocksFutureCalendarYearsUntilTheYearArrives() {
    assertTrue(service.isMarkPaidDisabled("February", "2027", "Unpaid", LocalDate.of(2027, 1, 31)));
    assertTrue(service.isFuturePayrollPeriod("February", "2027", LocalDate.of(2027, 1, 31)));
    assertFalse(service.isFuturePayrollPeriod("February", "2027", LocalDate.of(2027, 2, 1)));
    assertFalse(service.isMarkPaidDisabled("February", "2027", "Unpaid", LocalDate.of(2027, 2, 10)));
  }

  @Test
  void generatesPayslipOnlyWhenPaid() {
    assertTrue(service.canGeneratePayslip("PAID"));
    assertTrue(service.canGeneratePayslip("Paid"));
    assertFalse(service.canGeneratePayslip("Unpaid"));
  }

  @Test
  void parsesNumericAndTextMonths() {
    assertTrue(service.normalizeMonthIndex("June") == 5);
    assertTrue(service.normalizeMonthIndex("6") == 5);
    assertTrue(service.normalizeMonthIndex("0") == 0);
  }
}
