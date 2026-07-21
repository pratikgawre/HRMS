package com.kavya.hrms.repository;

import com.kavya.hrms.model.Interview;
import java.util.List;
import java.util.Optional;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface InterviewRepository extends MongoRepository<Interview, String> {
  List<Interview> findAllByOrderByInterviewDateDescInterviewTimeDesc();
  List<Interview> findBySharedWithAdminTrueOrderByInterviewDateDescInterviewTimeDesc();
  Optional<Interview> findByEmailIgnoreCase(String email);
  Optional<Interview> findByCandidateNameIgnoreCaseAndEmailIgnoreCaseAndPositionIgnoreCase(String candidateName, String email, String position);
}
