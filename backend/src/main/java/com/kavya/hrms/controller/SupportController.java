package com.kavya.hrms.controller;

import java.time.format.DateTimeFormatter;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Objects;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;

import com.kavya.hrms.model.SupportTicket;
import com.kavya.hrms.repository.SupportTicketRepository;

@RestController
@RequestMapping("/api/support")
public class SupportController {
  private final SupportTicketRepository repository;

  public SupportController(SupportTicketRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public List<SupportTicket> listTickets(@RequestParam(required = false) String employeeId) {
    if (employeeId != null && !employeeId.isBlank()) {
      return repository.findByEmployeeIdOrderByCreatedDateDesc(employeeId);
    }
    return repository.findAllByOrderByCreatedDateDesc();
  }

  @PostMapping
  public SupportTicket createTicket(@RequestBody SupportTicket payload) {
    SupportTicket safePayload = payload == null ? new SupportTicket() : payload;
    long count = repository.count();
    String ticketId = String.format("SUP-%d", 1000 + count + 1);
    safePayload.setTicketId(ticketId);

    String created = ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu"));
    safePayload.setCreatedDate(created);
    if (safePayload.getStatus() == null) {
      safePayload.setStatus("Pending");
    }

    return repository.save(safePayload);
  }

  @PatchMapping("/{id}/status")
  public ResponseEntity<SupportTicket> updateStatus(@PathVariable String id, @RequestBody StatusUpdateRequest request) {
    String safeId = id == null ? "" : id;
    StatusUpdateRequest safeRequest = request == null ? new StatusUpdateRequest() : request;
    return repository.findById(safeId)
        .map((ticket) -> {
          ticket.setStatus(Objects.requireNonNull(safeRequest.getStatus(), "status must not be null"));
          return ResponseEntity.ok(repository.save(ticket));
        })
        .orElse(ResponseEntity.notFound().build());
  }

  public static class StatusUpdateRequest {
    private String status;

    public String getStatus() {
      return status;
    }

    public void setStatus(String status) {
      this.status = status;
    }
  }
}
