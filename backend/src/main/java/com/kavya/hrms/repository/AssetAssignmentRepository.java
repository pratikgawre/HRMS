package com.kavya.hrms.repository;

import com.kavya.hrms.model.AssetAssignment;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AssetAssignmentRepository extends MongoRepository<AssetAssignment, String> {
  List<AssetAssignment> findAllByOrderByAssignedDateDesc();
  List<AssetAssignment> findByEmployeeIdOrderByAssignedDateDesc(String employeeId);
}
