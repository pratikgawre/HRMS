package com.kavya.hrms.repository;

import com.kavya.hrms.model.Notification;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface NotificationRepository extends MongoRepository<Notification, String> {
  List<Notification> findByUserIdOrderByCreatedAtDesc(String userId);
  List<Notification> findByUserIdAndReadStatusFalseOrderByCreatedAtDesc(String userId);
  Optional<Notification> findByIdAndUserId(String id, String userId);
  void deleteByUserId(String userId);
}
