package com.kavya.hrms.controller;

import com.kavya.hrms.model.Interview;
import com.kavya.hrms.repository.InterviewRepository;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/interviews")
public class InterviewController {
  private final InterviewRepository repository;

  public InterviewController(InterviewRepository repository) {
    this.repository = repository;
  }

  @GetMapping
  public List<Interview> list(
      @RequestParam(required = false) String shared,
      @RequestParam(required = false) String query) {
    List<Interview> interviews = "true".equalsIgnoreCase(shared)
        ? repository.findBySharedWithAdminTrueOrderByInterviewDateDescInterviewTimeDesc()
        : repository.findAllByOrderByInterviewDateDescInterviewTimeDesc();
    String search = normalize(query);
    if (search.isBlank()) {
      return interviews;
    }
    return interviews.stream().filter((item) ->
        contains(item.getCandidateName(), search)
            || contains(item.getEmail(), search)
            || contains(item.getPhone(), search)
            || contains(item.getPosition(), search)).toList();
  }

  @GetMapping("/{id}")
  public ResponseEntity<Interview> get(@PathVariable String id) {
    return repository.findById(id).map(ResponseEntity::ok).orElse(ResponseEntity.notFound().build());
  }

  @PostMapping
  public ResponseEntity<?> create(@RequestBody Interview interview) {
    Interview safe = sanitize(interview);
    if (safe.getCandidateName().isBlank() || safe.getPosition().isBlank()) {
      return ResponseEntity.badRequest().body("Candidate name and position are required");
    }
    if (repository.findByCandidateNameIgnoreCaseAndEmailIgnoreCaseAndPositionIgnoreCase(
        safe.getCandidateName(), safe.getEmail(), safe.getPosition()).isPresent()) {
      return ResponseEntity.badRequest().body("Duplicate interview record already exists");
    }
    safe.setCreatedDate(now());
    safe.setUpdatedDate(now());
    if (safe.getStatus().isBlank()) {
      safe.setStatus("Pending");
    }
    if (safe.getPriority().isBlank()) {
      safe.setPriority("Medium");
    }
    return ResponseEntity.ok(repository.save(safe));
  }

  @PutMapping("/{id}")
  public ResponseEntity<?> update(@PathVariable String id, @RequestBody Interview interview) {
    Interview safe = sanitize(interview);
    return repository.findById(id).map((existing) -> {
      copy(existing, safe);
      existing.setUpdatedDate(now());
      return ResponseEntity.ok(repository.save(existing));
    }).orElse(ResponseEntity.notFound().build());
  }

  @DeleteMapping("/{id}")
  public ResponseEntity<Void> delete(@PathVariable String id) {
    if (!repository.existsById(id)) {
      return ResponseEntity.notFound().build();
    }
    repository.deleteById(id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/{id}/share-admin")
  public ResponseEntity<Interview> shareWithAdmin(@PathVariable String id) {
    return repository.findById(id).map((existing) -> {
      existing.setSharedWithAdmin(true);
      existing.setUpdatedDate(now());
      return ResponseEntity.ok(repository.save(existing));
    }).orElse(ResponseEntity.notFound().build());
  }

  @GetMapping("/today")
  public ResponseEntity<?> today() {
    long count = repository.findAll().stream()
        .filter((interview) -> Objects.equals(interview.getInterviewDate(), nowDate()))
        .count();
    return ResponseEntity.ok(java.util.Map.of("count", count));
  }

  private static Interview sanitize(Interview interview) {
    Interview safe = interview == null ? new Interview() : interview;
    safe.setCandidateName(blankToDash(safe.getCandidateName()));
    safe.setEmail(blankToDash(safe.getEmail()));
    safe.setPhone(blankToDash(safe.getPhone()));
    safe.setPosition(blankToDash(safe.getPosition()));
    safe.setDepartment(blankToDash(safe.getDepartment()));
    safe.setExperience(blankToDash(safe.getExperience()));
    safe.setCurrentCompany(blankToDash(safe.getCurrentCompany()));
    safe.setCurrentCTC(blankToDash(safe.getCurrentCTC()));
    safe.setExpectedCTC(blankToDash(safe.getExpectedCTC()));
    safe.setResumeFile(blankToDash(safe.getResumeFile()));
    safe.setResumeFileName(blankToDash(safe.getResumeFileName()));
    safe.setResumeSource(blankToDash(safe.getResumeSource()));
    safe.setReferenceName("Reference".equalsIgnoreCase(safe.getResumeSource()) ? blankToDash(safe.getReferenceName()) : "");
    safe.setPriority(blankToDash(safe.getPriority()));
    safe.setInterviewDate(blankToDash(safe.getInterviewDate()));
    safe.setInterviewTime(blankToDash(safe.getInterviewTime()));
    safe.setInterviewMode(blankToDash(safe.getInterviewMode()));
    safe.setInterviewRound(blankToDash(safe.getInterviewRound()));
    safe.setInterviewer(blankToDash(safe.getInterviewer()));
    safe.setMeetingLink(blankToDash(safe.getMeetingLink()));
    safe.setLocation(blankToDash(safe.getLocation()));
    safe.setStatus(blankToDash(safe.getStatus()));
    safe.setRemarks(blankToDash(safe.getRemarks()));
    safe.setCreatedBy(blankToDash(safe.getCreatedBy()));
    return safe;
  }

  private static void copy(Interview target, Interview source) {
    target.setCandidateName(source.getCandidateName());
    target.setEmail(source.getEmail());
    target.setPhone(source.getPhone());
    target.setPosition(source.getPosition());
    target.setDepartment(source.getDepartment());
    target.setExperience(source.getExperience());
    target.setCurrentCompany(source.getCurrentCompany());
    target.setCurrentCTC(source.getCurrentCTC());
    target.setExpectedCTC(source.getExpectedCTC());
    target.setResumeFile(source.getResumeFile());
    target.setResumeFileName(source.getResumeFileName());
    target.setResumeSource(source.getResumeSource());
    target.setReferenceName("Reference".equalsIgnoreCase(source.getResumeSource()) ? source.getReferenceName() : "");
    target.setPriority(source.getPriority());
    target.setInterviewDate(source.getInterviewDate());
    target.setInterviewTime(source.getInterviewTime());
    target.setInterviewMode(source.getInterviewMode());
    target.setInterviewRound(source.getInterviewRound());
    target.setInterviewer(source.getInterviewer());
    target.setMeetingLink(source.getMeetingLink());
    target.setLocation(source.getLocation());
    target.setStatus(source.getStatus());
    target.setRemarks(source.getRemarks());
    target.setCreatedBy(source.getCreatedBy());
  }

  private static String blankToDash(String value) {
    return value == null || value.isBlank() ? "-" : value.trim();
  }

  private static boolean contains(String value, String search) {
    return normalize(value).contains(search);
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
  }

  private static String now() {
    return ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu HH:mm"));
  }

  private static String nowDate() {
    return ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu"));
  }
}
