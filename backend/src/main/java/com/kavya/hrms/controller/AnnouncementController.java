package com.kavya.hrms.controller;

import com.kavya.hrms.model.Announcement;
import com.kavya.hrms.repository.AnnouncementRepository;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {
  private final AnnouncementRepository announcementRepository;

  public AnnouncementController(AnnouncementRepository announcementRepository) {
    this.announcementRepository = announcementRepository;
  }

  @GetMapping
  public List<Announcement> list(@RequestParam(required = false) String category) {
    if (category == null || category.isBlank()) {
      return announcementRepository.findAll();
    }
    return announcementRepository.findByCategoryIgnoreCase(category);
  }

  @PostMapping
  public Announcement create(@RequestBody Announcement announcement) {
    return announcementRepository.save(announcement);
  }

  @PostMapping("/bulk")
  public List<Announcement> bulkSave(@RequestBody List<Announcement> announcements) {
    announcementRepository.deleteAll();
    return announcementRepository.saveAll(announcements);
  }

  @PutMapping("/{id}")
  public Announcement update(@PathVariable String id, @RequestBody Announcement announcement) {
    announcement.setId(id);
    return announcementRepository.save(announcement);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable String id) {
    announcementRepository.deleteById(id);
  }
}
