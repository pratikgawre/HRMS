package com.kavya.hrms.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;

import com.kavya.hrms.model.Announcement;

public interface AnnouncementRepository extends MongoRepository<Announcement, String> {
  List<Announcement> findByCategoryIgnoreCase(String category);

  @Query("{ 'category': { $not: { $regex: ?0, $options: 'i' } } }")
  List<Announcement> findByCategoryNotIgnoreCase(String category);
}
