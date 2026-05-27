package com.kavya.hrms.repository;

import java.util.List;
import org.springframework.data.mongodb.repository.MongoRepository;
import com.kavya.hrms.model.SupportTicket;

public interface SupportTicketRepository extends MongoRepository<SupportTicket, String> {
  List<SupportTicket> findByEmployeeIdOrderByCreatedDateDesc(String employeeId);
  List<SupportTicket> findAllByOrderByCreatedDateDesc();
}
