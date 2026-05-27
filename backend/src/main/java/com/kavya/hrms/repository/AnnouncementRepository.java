package com.kavya.hrms.repository;

import com.kavya.hrms.model.Announcement;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AnnouncementRepository extends MongoRepository<Announcement, String> {
  List<Announcement> findByCategoryIgnoreCase(String category);
}
