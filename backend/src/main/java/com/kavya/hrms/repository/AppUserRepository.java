package com.kavya.hrms.repository;

import com.kavya.hrms.model.AppUser;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AppUserRepository extends MongoRepository<AppUser, String> {
  Optional<AppUser> findByEmailIgnoreCase(String email);
}
