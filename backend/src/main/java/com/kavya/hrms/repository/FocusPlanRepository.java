package com.kavya.hrms.repository;

import com.kavya.hrms.model.FocusPlan;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface FocusPlanRepository extends MongoRepository<FocusPlan, String> {
}
