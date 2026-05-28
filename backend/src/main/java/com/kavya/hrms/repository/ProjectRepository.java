package com.kavya.hrms.repository;

import com.kavya.hrms.model.Project;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ProjectRepository extends MongoRepository<Project, String> {
}
