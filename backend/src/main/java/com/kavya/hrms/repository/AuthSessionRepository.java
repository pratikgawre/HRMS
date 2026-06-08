package com.kavya.hrms.repository;

import com.kavya.hrms.model.AuthSession;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AuthSessionRepository extends MongoRepository<AuthSession, String> {
}
