package com.kavya.hrms.controller;

import com.kavya.hrms.model.Announcement;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {
  private final AnnouncementRepository announcementRepository;
  private final NotificationService notificationService;

  public AnnouncementController(AnnouncementRepository announcementRepository, NotificationService notificationService) {
    this.announcementRepository = announcementRepository;
    this.notificationService = notificationService;
  }

  @GetMapping
  public List<Announcement> list(@RequestParam(required = false) String category) {
    if (category == null || category.isBlank()) {
      return announcementRepository.findAll();
    }
    return announcementRepository.findByCategoryIgnoreCase(category);
  }

  @PostMapping
  public Announcement create(
      @RequestBody Announcement announcement,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Announcement saved = announcementRepository.save(announcement);
    notificationService.notifyRoles(
        NotificationAudience.companyWideRecipients(),
        "New announcement posted",
        saved.getTitle() + " - " + saved.getCategory(),
        "announcement",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @PostMapping("/bulk")
  public List<Announcement> bulkSave(@RequestBody List<Announcement> announcements) {
    long existingCount = announcementRepository.count();
    announcementRepository.deleteAll();
    List<Announcement> saved = announcementRepository.saveAll(announcements);
    if (existingCount > 0) {
      notificationService.notifyRoles(
          NotificationAudience.companyWideRecipients(),
          "Announcements updated",
          "Company announcements were refreshed.",
          "announcement",
          "bulk",
          "admin",
          "System",
          null);
    }
    return saved;
  }

  @PutMapping("/{id}")
  public Announcement update(
      @PathVariable String id,
      @RequestBody Announcement announcement,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    announcement.setId(id);
    Announcement saved = announcementRepository.save(announcement);
    notificationService.notifyRoles(
        NotificationAudience.companyWideRecipients(),
        "Announcement updated",
        saved.getTitle() + " was updated.",
        "announcement",
        saved.getId(),
        accessRole,
        "System",
        userId);
    return saved;
  }

  @DeleteMapping("/{id}")
  public void delete(
      @PathVariable String id,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Announcement current = announcementRepository.findById(id).orElse(null);
    announcementRepository.deleteById(id);
    notificationService.notifyRoles(
        NotificationAudience.companyWideRecipients(),
        "Announcement removed",
        (current != null ? current.getTitle() : "An announcement") + " was removed.",
        "announcement",
        id,
        accessRole,
        "System",
        userId);
  }
}
