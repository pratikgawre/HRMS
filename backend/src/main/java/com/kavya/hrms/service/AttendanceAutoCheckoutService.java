package com.kavya.hrms.service;

import com.kavya.hrms.model.AttendanceRecord;
import com.kavya.hrms.repository.AttendanceRecordRepository;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.jspecify.annotations.Nullable;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
@SuppressWarnings("all")
public class AttendanceAutoCheckoutService {
  private static final ZoneId KOLKATA_ZONE = ZoneId.of("Asia/Kolkata");
  private static final LocalTime AUTO_CHECKOUT_TIME = LocalTime.of(21, 0);
  private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("hh:mm a", Locale.ENGLISH);
  private static final DateTimeFormatter DATE_LABEL_FORMATTER = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale.ENGLISH);
  private static final DateTimeFormatter ISO_DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

  private final AttendanceRecordRepository attendanceRecordRepository;

  public AttendanceAutoCheckoutService(AttendanceRecordRepository attendanceRecordRepository) {
    this.attendanceRecordRepository = attendanceRecordRepository;
  }

  public List<AttendanceRecord> finalizeOpenAttendanceRecords() {
    return finalizeOpenAttendanceRecords(LocalDateTime.now(KOLKATA_ZONE));
  }

  public List<AttendanceRecord> finalizeOpenAttendanceRecords(LocalDateTime now) {
    List<AttendanceRecord> records = attendanceRecordRepository.findAll();
    List<AttendanceRecord> updatedRecords = new ArrayList<>();

    for (AttendanceRecord record : records) {
      if (!shouldAutoCheckout(record, now)) {
        continue;
      }

      AttendanceRecord updated = applyAutoCheckout(record, now);
      if (isChanged(record, updated)) {
        updatedRecords.add(updated);
      }
    }

    if (!updatedRecords.isEmpty()) {
      attendanceRecordRepository.saveAll(updatedRecords);
    }

    return attendanceRecordRepository.findAll();
  }

  @Scheduled(cron = "0 0 21 * * *", zone = "Asia/Kolkata")
  public void runDailyAutoCheckout() {
    finalizeOpenAttendanceRecords();
  }

  private boolean shouldAutoCheckout(AttendanceRecord record, LocalDateTime now) {
    if (record == null || isBlank(record.getCheckIn()) || hasCheckout(record) || isLeave(record)) {
      return false;
    }

    LocalDate attendanceDate = getAttendanceDate(record);
    if (attendanceDate == null) {
      return false;
    }

    LocalDate today = now.toLocalDate();
    if (attendanceDate.isBefore(today)) {
      return true;
    }

    return !attendanceDate.isAfter(today) && !now.toLocalTime().isBefore(AUTO_CHECKOUT_TIME);
  }

  private AttendanceRecord applyAutoCheckout(AttendanceRecord record, LocalDateTime now) {
    LocalDate attendanceDate = getAttendanceDate(record);
    LocalDateTime checkoutMoment = LocalDateTime.of(
        attendanceDate != null ? attendanceDate : now.toLocalDate(),
        AUTO_CHECKOUT_TIME);

    int workedMinutes = Math.max(0, (int) java.time.Duration.between(parseCheckInMoment(record, attendanceDate), checkoutMoment).toMinutes());
    String status = getStatusFromMinutes(workedMinutes);

    AttendanceRecord updated = cloneRecord(record);
    updated.setCheckOut(formatTime(checkoutMoment.toLocalTime()));
    updated.setCheckOutAt(checkoutMoment.atZone(KOLKATA_ZONE).toInstant().toString());
    updated.setWorkedHours(formatDuration(workedMinutes));
    updated.setTotalHours(formatDuration(workedMinutes));
    updated.setStatus(status);
    return updated;
  }

  private LocalDateTime parseCheckInMoment(AttendanceRecord record, LocalDate attendanceDate) {
    if (record != null && !isBlank(record.getCheckInAt())) {
      try {
        return LocalDateTime.ofInstant(Instant.parse(record.getCheckInAt()), KOLKATA_ZONE);
      } catch (DateTimeParseException ignored) {
        // Fall back to the displayed check-in time when stored timestamp is unavailable or legacy.
      }
    }

    if (record != null && !isBlank(record.getCheckIn())) {
      LocalTime checkInTime = parseTime(record.getCheckIn());
      if (checkInTime != null) {
        return LocalDateTime.of(attendanceDate != null ? attendanceDate : LocalDate.now(KOLKATA_ZONE), checkInTime);
      }
    }

    return LocalDateTime.now(KOLKATA_ZONE);
  }

  @Nullable
  private LocalDate getAttendanceDate(AttendanceRecord record) {
    LocalDate parsed = parseDate(record != null ? record.getDateLabel() : null);
    if (parsed != null) {
      return parsed;
    }

    parsed = parseDate(record != null ? record.getDate() : null);
    if (parsed != null) {
      return parsed;
    }

    return null;
  }

  @Nullable
  private LocalDate parseDate(String value) {
    if (isBlank(value)) {
      return null;
    }

    String trimmed = value.trim();

    try {
      return LocalDate.parse(trimmed, DATE_LABEL_FORMATTER);
    } catch (DateTimeParseException ignored) {
      try {
        return LocalDate.parse(trimmed, ISO_DATE_FORMATTER);
      } catch (DateTimeParseException ignoredAgain) {
        return null;
      }
    }
  }

  @Nullable
  private LocalTime parseTime(String value) {
    if (isBlank(value) || "-".equals(value.trim())) {
      return null;
    }

    try {
      return LocalTime.parse(value.trim().toUpperCase(Locale.ENGLISH), TIME_FORMATTER);
    } catch (DateTimeParseException ignored) {
      return null;
    }
  }

  private String formatTime(LocalTime time) {
    return time.format(TIME_FORMATTER);
  }

  private String formatDuration(int minutes) {
    int hours = minutes / 60;
    int remainingMinutes = minutes % 60;
    return hours + "h " + String.format(Locale.ENGLISH, "%02dm", remainingMinutes);
  }

  private String getStatusFromMinutes(int workedMinutes) {
    if (workedMinutes >= 8 * 60) {
      return "Present";
    }

    if (workedMinutes >= 4 * 60) {
      return "Half Day";
    }

    return "Absent";
  }

  private boolean hasCheckout(AttendanceRecord record) {
    return record != null && !isBlank(record.getCheckOut()) && !"-".equals(record.getCheckOut().trim());
  }

  private boolean isLeave(AttendanceRecord record) {
    return record != null && "Leave".equalsIgnoreCase(String.valueOf(record.getStatus()));
  }

  private boolean isChanged(AttendanceRecord before, AttendanceRecord after) {
    return before == null || after == null
        || !Objects.equals(before.getCheckOut(), after.getCheckOut())
        || !Objects.equals(before.getCheckOutAt(), after.getCheckOutAt())
        || !Objects.equals(before.getWorkedHours(), after.getWorkedHours())
        || !Objects.equals(before.getTotalHours(), after.getTotalHours())
        || !Objects.equals(before.getStatus(), after.getStatus());
  }

  private AttendanceRecord cloneRecord(AttendanceRecord record) {
    AttendanceRecord clone = new AttendanceRecord();
    clone.setId(record.getId());
    clone.setEmployeeId(record.getEmployeeId());
    clone.setEmployeeName(record.getEmployeeName());
    clone.setDateLabel(record.getDateLabel());
    clone.setDate(record.getDate());
    clone.setCheckIn(record.getCheckIn());
    clone.setCheckOut(record.getCheckOut());
    clone.setCheckInAt(record.getCheckInAt());
    clone.setCheckOutAt(record.getCheckOutAt());
    clone.setWorkedHours(record.getWorkedHours());
    clone.setTotalHours(record.getTotalHours());
    clone.setStatus(record.getStatus());
    clone.setRemarks(record.getRemarks());
    return clone;
  }

  private boolean isBlank(String value) {
    return value == null || value.trim().isEmpty();
  }
}
