package com.kavya.hrms.controller;

import com.kavya.hrms.model.Announcement;
import com.kavya.hrms.repository.AnnouncementRepository;
import com.kavya.hrms.service.NotificationAudience;
import com.kavya.hrms.service.NotificationService;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import org.bson.Document;
import org.springframework.data.mongodb.core.MongoTemplate;
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
  private final MongoTemplate mongoTemplate;

  public AnnouncementController(
      AnnouncementRepository announcementRepository,
      NotificationService notificationService,
      MongoTemplate mongoTemplate) {
    this.announcementRepository = announcementRepository;
    this.notificationService = notificationService;
    this.mongoTemplate = mongoTemplate;
  }

  @GetMapping
  public List<Announcement> list(@RequestParam(required = false) String category) {
    List<Announcement> announcements = loadAnnouncementsSafely();
    return announcements.stream()
        .filter(Objects::nonNull)
        .filter(announcement -> category == null
            || category.isBlank()
            || equalsIgnoreCase(announcement.getCategory(), category))
        .sorted(Comparator.comparing(
            (Announcement announcement) -> asString(announcement.getPostedAt())).reversed())
        .toList();
  }

  @PostMapping
  public Announcement create(
      @RequestBody Announcement announcement,
      @RequestHeader(value = "X-Kavya-Access-Role", required = false) String accessRole,
      @RequestHeader(value = "X-Kavya-User-Id", required = false) String userId) {
    Announcement saved = announcementRepository.save(Objects.requireNonNull(announcement));
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
    List<Announcement> saved = announcementRepository.saveAll(Objects.requireNonNull(announcements));
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
    Announcement saved = announcementRepository.save(Objects.requireNonNull(announcement));
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
    String announcementId = Objects.requireNonNull(id, "id must not be null");
    Announcement current = announcementRepository.findById(announcementId).orElse(null);
    announcementRepository.deleteById(announcementId);
    notificationService.notifyRoles(
        NotificationAudience.companyWideRecipients(),
        "Announcement removed",
        (current != null ? current.getTitle() : "An announcement") + " was removed.",
        "announcement",
        announcementId,
        accessRole,
        "System",
        userId);
  }

  private Announcement fromDocument(Document document) {
    Announcement announcement = new Announcement();
    if (document == null) {
      return announcement;
    }

    announcement.setId(asString(document.get("_id")));
    announcement.setTitle(asString(document.get("title")));
    announcement.setBody(asString(document.get("body")));
    announcement.setCategory(asString(document.get("category")));
    announcement.setPriority(asString(document.get("priority")));
    announcement.setDateLabel(asString(document.get("dateLabel")));
    announcement.setPostedAt(asString(document.get("postedAt")));
    announcement.setPostedBy(asString(document.get("postedBy")));
    announcement.setOwnerRole(asString(document.get("ownerRole")));
    announcement.setStatus(asString(document.get("status")));
    return announcement;
  }

  private List<Announcement> loadAnnouncementsSafely() {
    try {
      List<Document> documents = mongoTemplate.findAll(Document.class, "announcements");
      List<Announcement> announcements = new ArrayList<>();
      for (Document document : documents) {
        announcements.add(fromDocument(document));
      }
      return announcements;
    } catch (RuntimeException ex) {
      return List.of();
    }
  }

  private String asString(Object value) {
    return value == null ? "" : String.valueOf(value).trim();
  }

  private boolean equalsIgnoreCase(String left, String right) {
    return asString(left).equalsIgnoreCase(asString(right));
  }
}
