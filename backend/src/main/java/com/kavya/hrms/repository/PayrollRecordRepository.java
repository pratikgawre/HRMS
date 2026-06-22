package com.kavya.hrms.repository;

import com.kavya.hrms.model.PayrollRecord;
import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface PayrollRecordRepository extends MongoRepository<PayrollRecord, String> {
  List<PayrollRecord> findByEmployeeId(String employeeId);
  List<PayrollRecord> findByMonthAndYear(String month, String year);
  List<PayrollRecord> findByEmployeeIdAndMonthAndYear(String employeeId, String month, String year);
  void deleteByMonthAndYear(String month, String year);
}
