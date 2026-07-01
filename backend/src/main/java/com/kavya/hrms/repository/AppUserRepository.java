package com.kavya.hrms.repository;

import com.kavya.hrms.model.AppUser;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AppUserRepository extends MongoRepository<AppUser, String> {
  List<AppUser> findAllByEmailIgnoreCase(String email);
  Optional<AppUser> findByEmailIgnoreCase(String email);
  List<AppUser> findAllByUserId(String userId);
  default Optional<AppUser> findByUserId(String userId) {
    return findAllByUserId(userId).stream().findFirst();
  }
  List<AppUser> findAllByEmployeeId(String employeeId);
  default Optional<AppUser> findByEmployeeId(String employeeId) {
    return findAllByEmployeeId(employeeId).stream().findFirst();
  }
  List<AppUser> findByEmployeeIdIn(Collection<String> employeeIds);
  List<AppUser> findByRoleIgnoreCase(String role);
}

