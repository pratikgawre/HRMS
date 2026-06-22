package com.kavya.hrms.service;

import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class PayrollValidationServiceTest {
  private final PayrollValidationService service = new PayrollValidationService();

  @Test
  void enablesCurrentMonthBeforeCutoff() {
    assertFalse(service.isMarkPaidDisabled("June", "2026", "Unpaid", LocalDate.of(2026, 6, 10)));
    assertFalse(service.isMarkPaidDisabled("6", "2026", "Unpaid", LocalDate.of(2026, 6, 15)));
  }

  @Test
  void disablesCurrentMonthAfterCutoffUnlessAlreadyPaid() {
    assertTrue(service.isMarkPaidDisabled("June", "2026", "Unpaid", LocalDate.of(2026, 6, 16)));
    assertTrue(service.isMarkPaidDisabled("June", "2026", "Paid", LocalDate.of(2026, 6, 30)));
  }

  @Test
  void keepsPreviousMonthsEnabled() {
    assertFalse(service.isMarkPaidDisabled("May", "2026", "Unpaid", LocalDate.of(2026, 7, 15)));
    assertFalse(service.isMarkPaidDisabled("December", "2025", "Unpaid", LocalDate.of(2026, 7, 15)));
    assertFalse(service.isMarkPaidDisabled("May", "2026", "Unpaid", LocalDate.of(2026, 6, 16)));
    assertFalse(service.isMarkPaidDisabled("June", "2025", "Unpaid", LocalDate.of(2026, 6, 16)));
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
