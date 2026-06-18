package com.kavya.hrms.repository;

import com.kavya.hrms.model.TaskItem;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TaskRepository extends MongoRepository<TaskItem, String> {
  List<TaskItem> findByAssignedToId(String assignedToId);
  List<TaskItem> findByAssignedById(String assignedById);
  List<TaskItem> findByOwnerIgnoreCase(String owner);
  List<TaskItem> findByAssignedToNameIgnoreCase(String assignedToName);
}
