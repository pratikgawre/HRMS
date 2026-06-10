package com.kavya.hrms.repository;

import com.kavya.hrms.model.LeaveRequest;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface LeaveRequestRepository extends MongoRepository<LeaveRequest, String> {
  List<LeaveRequest> findByEmployeeId(String employeeId);
}
