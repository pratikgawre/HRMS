package com.kavya.hrms.controller;

import com.kavya.hrms.model.LeaveRequest;
import com.kavya.hrms.repository.LeaveRequestRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/leaves")
public class LeaveController {
  private final LeaveRequestRepository leaveRequestRepository;

  public LeaveController(LeaveRequestRepository leaveRequestRepository) {
    this.leaveRequestRepository = leaveRequestRepository;
  }

  @GetMapping
  public List<LeaveRequest> list() {
    return leaveRequestRepository.findAll();
  }

  @PostMapping
  public LeaveRequest create(@RequestBody LeaveRequest request) {
    return leaveRequestRepository.save(request);
  }

  @PostMapping("/bulk")
  public List<LeaveRequest> bulkSave(@RequestBody List<LeaveRequest> requests) {
    leaveRequestRepository.deleteAll();
    return leaveRequestRepository.saveAll(requests);
  }

  @PutMapping("/{id}")
  public LeaveRequest update(@PathVariable String id, @RequestBody LeaveRequest request) {
    request.setId(id);
    return leaveRequestRepository.save(request);
  }
}
