package com.kavya.hrms.controller;

import com.kavya.hrms.model.SystemSettings;
import com.kavya.hrms.repository.SystemSettingsRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SystemSettingsController {
  private static final String DEFAULT_ID = "default";
  private final SystemSettingsRepository repository;

  public SystemSettingsController(SystemSettingsRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public SystemSettings get() {
    return repository.findById(DEFAULT_ID).orElseGet(this::buildDefaultSettings);
  }

  @PutMapping
  public SystemSettings save(@RequestBody SystemSettings settings) {
    settings.setId(DEFAULT_ID);
    return repository.save(settings);
  }

  private SystemSettings buildDefaultSettings() {
    SystemSettings settings = new SystemSettings();
    settings.setId(DEFAULT_ID);
    settings.setCompanyName("Kavya HRMS");
    settings.setTimezone("Asia/Kolkata");
    settings.setWorkingHours("09:00 AM - 06:00 PM");
    settings.setWeekOff("Sunday");
    settings.setPayrollCutoff("25th of every month");
    return settings;
  }
}
