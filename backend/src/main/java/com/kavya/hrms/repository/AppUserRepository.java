package com.kavya.hrms.repository;

import com.kavya.hrms.model.AppUser;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AppUserRepository extends MongoRepository<AppUser, String> {
  List<AppUser> findAllByEmailIgnoreCase(String email);
  Optional<AppUser> findByEmailIgnoreCase(String email);
  Optional<AppUser> findByUserId(String userId);
  Optional<AppUser> findByEmployeeId(String employeeId);
  List<AppUser> findByEmployeeIdIn(Collection<String> employeeIds);
  List<AppUser> findByRoleIgnoreCase(String role);
}
