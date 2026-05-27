package com.kavya.hrms.repository;

import com.kavya.hrms.model.AttendanceRecord;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface AttendanceRecordRepository extends MongoRepository<AttendanceRecord, String> {
  List<AttendanceRecord> findByEmployeeId(String employeeId);
}
