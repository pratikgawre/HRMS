package com.kavya.hrms.repository;

import com.kavya.hrms.model.SystemSettings;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface SystemSettingsRepository extends MongoRepository<SystemSettings, String> {
}
