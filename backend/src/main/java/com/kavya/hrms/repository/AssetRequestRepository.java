package com.kavya.hrms.repository;

import com.kavya.hrms.model.AssetRequest;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AssetRequestRepository extends MongoRepository<AssetRequest, String> {
  List<AssetRequest> findAllByOrderByCreatedDateDesc();
  List<AssetRequest> findByEmployeeIdOrderByCreatedDateDesc(String employeeId);
}
