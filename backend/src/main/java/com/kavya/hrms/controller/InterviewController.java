package com.kavya.hrms.controller;

import com.kavya.hrms.model.Interview;
import com.kavya.hrms.repository.InterviewRepository;
import com.kavya.hrms.service.InterviewNotificationEmailService;
import java.time.LocalDate;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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
  private static final Logger log = LoggerFactory.getLogger(InterviewController.class);
  private static final Pattern NAME_PATTERN = Pattern.compile("^[A-Za-z]+(?:[ '-][A-Za-z]+)*$");
  private static final Pattern POSITION_PATTERN = Pattern.compile("^(?=.*[A-Za-z])[A-Za-z +/()-]+$");
  private static final Pattern DEPARTMENT_PATTERN = Pattern.compile("^[A-Za-z]+(?:[ -][A-Za-z]+)*$");
  private static final Pattern COMPANY_PATTERN = Pattern.compile("^(?=.*[A-Za-z])[A-Za-z0-9 .,&()'-]+$");
  private static final Pattern LOCATION_PATTERN = Pattern.compile("^(?=.*[A-Za-z])[A-Za-z0-9 ,.()/-]+$");
  private static final Pattern EXPERIENCE_PATTERN = Pattern.compile("^\\d+(?:\\.\\d+)?$");
  private static final Pattern NUMBER_ONLY_PATTERN = Pattern.compile("^\\d+$");

  private final InterviewRepository repository;
  private final InterviewNotificationEmailService interviewNotificationEmailService;

  public InterviewController(
      InterviewRepository repository,
      InterviewNotificationEmailService interviewNotificationEmailService) {
    this.repository = repository;
    this.interviewNotificationEmailService = interviewNotificationEmailService;
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
    ResponseEntity<?> validation = validateInterview(safe);
    if (validation != null) {
      return validation;
    }
    if (repository.findByEmailIgnoreCase(safe.getEmail()).isPresent()) {
      return duplicateEmailResponse();
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
    Interview saved = repository.save(safe);
    sendCandidateScheduleEmail(saved);
    return ResponseEntity.ok(saved);
  }

  @PutMapping("/{id}")
  public ResponseEntity<?> update(@PathVariable String id, @RequestBody Interview interview) {
    Interview safe = sanitize(interview);
    ResponseEntity<?> validation = validateInterview(safe);
    if (validation != null) {
      return validation;
    }

    return repository.findById(id).<ResponseEntity<?>>map((existing) -> {
      if (repository.findByEmailIgnoreCase(safe.getEmail())
          .filter((emailOwner) -> !Objects.equals(emailOwner.getId(), id))
          .isPresent()) {
        return duplicateEmailResponse();
      }

      copy(existing, safe);
      existing.setUpdatedDate(now());
      Interview saved = repository.save(existing);
      sendCandidateUpdateEmail(saved);
      return ResponseEntity.ok(saved);
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

  private ResponseEntity<?> validateInterview(Interview interview) {
    Map<String, String> fieldErrors = new LinkedHashMap<>();
    addPatternError(fieldErrors, "candidateName", interview == null ? "" : interview.getCandidateName(), "Candidate Name", NAME_PATTERN, true);
    addPatternError(fieldErrors, "position", interview == null ? "" : interview.getPosition(), "Position Applied", POSITION_PATTERN, true);
    addPatternError(fieldErrors, "department", interview == null ? "" : interview.getDepartment(), "Department", DEPARTMENT_PATTERN, true);
    addPatternError(fieldErrors, "currentCompany", interview == null ? "" : interview.getCurrentCompany(), "Current Company", COMPANY_PATTERN, true);
    addPatternError(fieldErrors, "location", interview == null ? "" : interview.getLocation(), "Interview Location", LOCATION_PATTERN, true);
    addExperienceError(fieldErrors, interview == null ? "" : interview.getExperience());
    addPatternError(fieldErrors, "interviewer", interview == null ? "" : interview.getInterviewer(), "Interviewer Name", NAME_PATTERN, true);
    addPatternError(fieldErrors, "createdBy", interview == null ? "" : interview.getCreatedBy(), "Created By", NAME_PATTERN, true);
    addNumberOnlyError(fieldErrors, "currentCTC", interview == null ? "" : interview.getCurrentCTC(), "Current CTC");
    addNumberOnlyError(fieldErrors, "expectedCTC", interview == null ? "" : interview.getExpectedCTC(), "Expected CTC");
    addInterviewDateError(fieldErrors, interview == null ? "" : interview.getInterviewDate());

    if (fieldErrors.isEmpty()) {
      return null;
    }

    return ResponseEntity.badRequest().body(Map.of(
        "message", "Please fix the highlighted interview fields.",
        "fieldErrors", fieldErrors));
  }

  private void addPatternError(Map<String, String> fieldErrors, String field, String value, String label, Pattern pattern, boolean required) {
    String safeValue = businessValue(value);
    if (safeValue.isBlank()) {
      if (required) {
        fieldErrors.put(field, label + " is required.");
      }
      return;
    }

    if (!pattern.matcher(safeValue).matches()) {
      fieldErrors.put(field, "Enter a valid " + label + ".");
    }
  }

  private void addExperienceError(Map<String, String> fieldErrors, String value) {
    String safeValue = businessValue(value);
    if (safeValue.isBlank()) {
      fieldErrors.put("experience", "Years of Experience is required.");
      return;
    }

    if (!EXPERIENCE_PATTERN.matcher(safeValue).matches()) {
      fieldErrors.put("experience", "Enter valid Years of Experience.");
    }
  }

  private void addNumberOnlyError(Map<String, String> fieldErrors, String field, String value, String label) {
    String safeValue = businessValue(value);
    if (!safeValue.isBlank() && !NUMBER_ONLY_PATTERN.matcher(safeValue).matches()) {
      fieldErrors.put(field, label + " should contain numbers only.");
    }
  }

  private void addInterviewDateError(Map<String, String> fieldErrors, String value) {
    String safeValue = businessValue(value);
    if (safeValue.isBlank()) {
      return;
    }

    try {
      LocalDate interviewDate = LocalDate.parse(safeValue);
      if (interviewDate.isBefore(LocalDate.now())) {
        fieldErrors.put("interviewDate", "Past interview dates are not allowed.");
      }
    } catch (DateTimeParseException ignored) {
      fieldErrors.put("interviewDate", "Use a valid interview date.");
    }
  }

  private ResponseEntity<?> duplicateEmailResponse() {
    return ResponseEntity.badRequest().body(Map.of(
        "message", "Candidate email already exists.",
        "fieldErrors", Map.of("email", "This email already exists in the interview database.")));
  }

  private String businessValue(String value) {
    if (value == null) {
      return "";
    }
    String trimmed = value.trim();
    return trimmed.isEmpty() || "-".equals(trimmed) ? "" : trimmed;
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

  private void sendCandidateScheduleEmail(Interview interview) {
    InterviewNotificationEmailService.DeliveryResult delivery =
        interviewNotificationEmailService.sendInterviewScheduleEmail(interview);
    if (delivery.isSent()) {
      log.info("Interview schedule email sent for interview {} to {}.",
          interview == null ? "<unknown>" : interview.getId(),
          interview == null ? "<unknown>" : interview.getEmail());
      return;
    }

    log.warn("Interview schedule email was not sent for interview {}: {}",
        interview == null ? "<unknown>" : interview.getId(),
        delivery.getMessage());
  }

  private void sendCandidateUpdateEmail(Interview interview) {
    InterviewNotificationEmailService.DeliveryResult delivery =
        interviewNotificationEmailService.sendInterviewUpdateEmail(interview);
    if (delivery.isSent()) {
      log.info("Interview update email sent for interview {} to {}.",
          interview == null ? "<unknown>" : interview.getId(),
          interview == null ? "<unknown>" : interview.getEmail());
      return;
    }

    log.warn("Interview update email was not sent for interview {}: {}",
        interview == null ? "<unknown>" : interview.getId(),
        delivery.getMessage());
  }

  private static String blankToDash(String value) {
    return value == null || value.isBlank() ? "-" : value.trim();
  }

  private static boolean contains(String value, String search) {
    return normalize(value).contains(search);
  }

  private static String normalize(String value) {
    return value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT);
  }

  private static String now() {
    return ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu HH:mm"));
  }

  private static String nowDate() {
    return ZonedDateTime.now().format(DateTimeFormatter.ofPattern("dd MMM uuuu"));
  }
}
