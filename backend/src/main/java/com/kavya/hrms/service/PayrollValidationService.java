package com.kavya.hrms.service;

import com.kavya.hrms.model.PayrollRecord;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

@Service
@SuppressWarnings("all")
public class PayrollValidationService {
  private static final Map<String, Integer> MONTH_INDEX_BY_NAME = buildMonthIndexMap();

  public boolean isMarkPaidDisabled(String salaryMonth, String salaryYear, String status, LocalDate today) {
    if (isPaidStatus(status)) {
      return true;
    }

    Integer monthIndex = normalizeMonthIndex(salaryMonth);
    Integer year = normalizeYear(salaryYear);
    if (monthIndex == null || year == null) {
      return true;
    }

    if (isFuturePayrollPeriod(monthIndex, year, today)) {
      return true;
    }

    if (year != today.getYear() || monthIndex != today.getMonthValue() - 1) {
      return false;
    }

    return today.getDayOfMonth() > 15;
  }

  public boolean canGeneratePayslip(String status) {
    return isPaidStatus(status);
  }

  public boolean canGeneratePayslip(PayrollRecord record) {
    return record != null && canGeneratePayslip(record.getStatus()) && record.getNetSalary() > 0;
  }

  public boolean isCurrentMonthUnpaidAfterCutoff(PayrollRecord record, LocalDate today) {
    if (record == null || isPaidStatus(record.getStatus())) {
      return false;
    }

    Integer monthIndex = normalizeMonthIndex(record.getMonth());
    Integer year = normalizeYear(record.getYear());
    if (monthIndex == null || year == null) {
      return false;
    }

    return year == today.getYear()
        && monthIndex == today.getMonthValue() - 1;
  }

  public boolean isFuturePayrollYear(String salaryYear, LocalDate today) {
    Integer year = normalizeYear(salaryYear);
    return year != null && year > today.getYear();
  }

  public boolean isFuturePayrollPeriod(String salaryMonth, String salaryYear, LocalDate today) {
    Integer monthIndex = normalizeMonthIndex(salaryMonth);
    Integer year = normalizeYear(salaryYear);
    if (monthIndex == null || year == null) {
      return true;
    }

    return isFuturePayrollPeriod(monthIndex, year, today);
  }

  private boolean isFuturePayrollPeriod(Integer monthIndex, Integer year, LocalDate today) {
    int currentYear = today.getYear();
    int currentMonthIndex = today.getMonthValue() - 1;
    return year > currentYear || (year.equals(currentYear) && monthIndex > currentMonthIndex);
  }

  public boolean isPaidStatus(String status) {
    return "paid".equalsIgnoreCase(String.valueOf(status).trim());
  }

  @Nullable
  public Integer normalizeMonthIndex(String salaryMonth) {
    String rawValue = String.valueOf(salaryMonth == null ? "" : salaryMonth).trim();
    if (rawValue.isEmpty()) {
      return null;
    }

    try {
      int numericMonth = Integer.parseInt(rawValue);
      if (numericMonth >= 1 && numericMonth <= 12) {
        return numericMonth - 1;
      }
      if (numericMonth == 0) {
        return 0;
      }
    } catch (NumberFormatException ignored) {
      // Fall through to name parsing.
    }

    Integer monthIndex = MONTH_INDEX_BY_NAME.get(rawValue.toUpperCase(Locale.ENGLISH));
    if (monthIndex != null) {
      return monthIndex;
    }

    String prefix = rawValue.length() >= 3 ? rawValue.substring(0, 3).toUpperCase(Locale.ENGLISH) : rawValue.toUpperCase(Locale.ENGLISH);
    return MONTH_INDEX_BY_NAME.get(prefix);
  }

  @Nullable
  private Integer normalizeYear(String salaryYear) {
    try {
      return Integer.valueOf(String.valueOf(salaryYear).trim());
    } catch (Exception ex) {
      return null;
    }
  }

  private static Map<String, Integer> buildMonthIndexMap() {
    Map<String, Integer> months = new HashMap<>();
    months.put("JANUARY", 0);
    months.put("JAN", 0);
    months.put("FEBRUARY", 1);
    months.put("FEB", 1);
    months.put("MARCH", 2);
    months.put("MAR", 2);
    months.put("APRIL", 3);
    months.put("APR", 3);
    months.put("MAY", 4);
    months.put("JUNE", 5);
    months.put("JUN", 5);
    months.put("JULY", 6);
    months.put("JUL", 6);
    months.put("AUGUST", 7);
    months.put("AUG", 7);
    months.put("SEPTEMBER", 8);
    months.put("SEP", 8);
    months.put("OCTOBER", 9);
    months.put("OCT", 9);
    months.put("NOVEMBER", 10);
    months.put("NOV", 10);
    months.put("DECEMBER", 11);
    months.put("DEC", 11);
    return months;
  }
}
