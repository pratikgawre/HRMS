package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kavya.hrms.model.Interview;
import com.kavya.hrms.repository.InterviewRepository;
import com.kavya.hrms.service.InterviewNotificationEmailService;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.ResponseEntity;

@SuppressWarnings("all")
class InterviewControllerTest {
  private InterviewRepository repository;
  private InterviewNotificationEmailService emailService;
  private InterviewController controller;

  @BeforeEach
  void setUp() {
    repository = mock(InterviewRepository.class);
    emailService = mock(InterviewNotificationEmailService.class);
    controller = new InterviewController(repository, emailService);
  }

  @Test
  void createShouldSaveInterviewAndSendScheduleEmailToCandidate() {
    Interview request = buildInterview();
    when(repository.findByEmailIgnoreCase("gawrepratik@gmail.com")).thenReturn(Optional.empty());
    when(repository.findByCandidateNameIgnoreCaseAndEmailIgnoreCaseAndPositionIgnoreCase(
        "Gawrepratik",
        "gawrepratik@gmail.com",
        "Associate Software Engineer")).thenReturn(Optional.empty());
    when(repository.save(any(Interview.class))).thenAnswer((invocation) -> {
      Interview saved = invocation.getArgument(0, Interview.class);
      saved.setId("IV-1001");
      return saved;
    });
    when(emailService.sendInterviewScheduleEmail(any(Interview.class)))
        .thenReturn(InterviewNotificationEmailService.DeliveryResult.sent());

    ResponseEntity<?> response = controller.create(request);

    assertEquals(200, response.getStatusCode().value());
    ArgumentCaptor<Interview> emailInterview = ArgumentCaptor.forClass(Interview.class);
    verify(emailService).sendInterviewScheduleEmail(emailInterview.capture());
    assertEquals("IV-1001", emailInterview.getValue().getId());
    assertEquals("gawrepratik@gmail.com", emailInterview.getValue().getEmail());
    assertEquals("Associate Software Engineer", emailInterview.getValue().getPosition());
  }

  @Test
  void createShouldRejectDuplicateEmailAndNotSendEmail() {
    Interview request = buildInterview();
    Interview existing = buildInterview();
    existing.setId("IV-OLD");
    when(repository.findByEmailIgnoreCase("gawrepratik@gmail.com")).thenReturn(Optional.of(existing));

    ResponseEntity<?> response = controller.create(request);

    assertEquals(400, response.getStatusCode().value());
    verify(repository, never()).save(any(Interview.class));
    verify(emailService, never()).sendInterviewScheduleEmail(any(Interview.class));
  }

  @Test
  void createShouldNotSendEmailWhenInterviewIsDuplicate() {
    Interview request = buildInterview();
    when(repository.findByEmailIgnoreCase("gawrepratik@gmail.com")).thenReturn(Optional.empty());
    when(repository.findByCandidateNameIgnoreCaseAndEmailIgnoreCaseAndPositionIgnoreCase(
        "Gawrepratik",
        "gawrepratik@gmail.com",
        "Associate Software Engineer")).thenReturn(Optional.of(request));

    ResponseEntity<?> response = controller.create(request);

    assertEquals(400, response.getStatusCode().value());
    verify(emailService, never()).sendInterviewScheduleEmail(any(Interview.class));
  }

  @Test
  void updateShouldSaveInterviewAndSendUpdateEmailToCandidate() {
    Interview request = buildInterview();
    Interview existing = buildInterview();
    existing.setId("IV-1001");
    when(repository.findById("IV-1001")).thenReturn(Optional.of(existing));
    when(repository.findByEmailIgnoreCase("gawrepratik@gmail.com")).thenReturn(Optional.of(existing));
    when(repository.save(any(Interview.class))).thenAnswer((invocation) -> invocation.getArgument(0, Interview.class));
    when(emailService.sendInterviewUpdateEmail(any(Interview.class)))
        .thenReturn(InterviewNotificationEmailService.DeliveryResult.sent());

    ResponseEntity<?> response = controller.update("IV-1001", request);

    assertEquals(200, response.getStatusCode().value());
    verify(emailService).sendInterviewUpdateEmail(existing);
  }

  @Test
  void deleteShouldRemoveInterviewFromRepository() {
    when(repository.existsById("IV-1001")).thenReturn(true);

    ResponseEntity<Void> response = controller.delete("IV-1001");

    assertEquals(204, response.getStatusCode().value());
    verify(repository).deleteById("IV-1001");
  }

  @Test
  void deleteShouldReturnNotFoundWhenInterviewDoesNotExist() {
    when(repository.existsById("IV-MISSING")).thenReturn(false);

    ResponseEntity<Void> response = controller.delete("IV-MISSING");

    assertEquals(404, response.getStatusCode().value());
    verify(repository, never()).deleteById("IV-MISSING");
  }
  private Interview buildInterview() {
    Interview interview = new Interview();
    interview.setCandidateName("Gawrepratik");
    interview.setEmail("gawrepratik@gmail.com");
    interview.setPhone("9876543210");
    interview.setPosition("Associate Software Engineer");
    interview.setDepartment("Development");
    interview.setExperience("2 years");
    interview.setCurrentCompany("Kavya Infoweb Pvt. Ltd.");
    interview.setCurrentCTC("400000");
    interview.setExpectedCTC("550000");
    interview.setInterviewDate(LocalDate.now().plusDays(1).toString());
    interview.setInterviewTime("11:00");
    interview.setInterviewMode("Online");
    interview.setInterviewRound("Technical Round");
    interview.setInterviewer("Meera Nair");
    interview.setMeetingLink("https://meet.example.com/interview");
    interview.setLocation("Google Meet");
    interview.setRemarks("Please keep your resume and portfolio ready.");
    interview.setResumeSource("Other");
    interview.setCreatedBy("HR Team");
    return interview;
  }
}