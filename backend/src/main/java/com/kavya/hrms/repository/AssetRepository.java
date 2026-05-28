package com.kavya.hrms.repository;

import com.kavya.hrms.model.Asset;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AssetRepository extends MongoRepository<Asset, String> {
  List<Asset> findByStatusIgnoreCase(String status);
}
