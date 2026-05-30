package com.kavya.hrms.repository;

import com.kavya.hrms.model.TaskItem;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface TaskRepository extends MongoRepository<TaskItem, String> {
}
