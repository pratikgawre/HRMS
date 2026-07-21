package com.kavya.hrms.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

import com.kavya.hrms.model.Interview;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;

@SuppressWarnings("all")
class InterviewNotificationEmailServiceTest {
  @Test
  void templateShouldIncludeFullInterviewDetails() {
    InterviewNotificationEmailService service = new InterviewNotificationEmailService(mock(Environment.class));
    Interview interview = buildInterview();

    String plainText = service.buildPlainTextMessage(interview);
    String html = service.buildHtmlMessage(interview);

    assertTrue(plainText.contains("Candidate Name: Gawrepratik"));
    assertTrue(plainText.contains("Position Applied: Associate Software Engineer"));
    assertTrue(plainText.contains("Department: Development"));
    assertTrue(plainText.contains("Interview Round: Technical Round"));
    assertTrue(plainText.contains("Interview Mode: Online"));
    assertTrue(plainText.contains("Interview Date: 22 Jul 2026"));
    assertTrue(plainText.contains("Interview Time: 11:00 AM"));
    assertTrue(plainText.contains("Interviewer Name: Meera Nair"));
    assertTrue(plainText.contains("Meeting Link: https://meet.example.com/interview"));
    assertTrue(plainText.contains("Remarks: Please keep your resume and portfolio ready."));
    assertTrue(html.contains("Open Meeting Link"));
    assertTrue(html.contains("Associate Software Engineer"));
  }

  @Test
  void updateTemplateShouldClearlySayDetailsWereUpdated() {
    InterviewNotificationEmailService service = new InterviewNotificationEmailService(mock(Environment.class));
    Interview interview = buildInterview();

    String plainText = service.buildPlainTextMessage(interview, true);
    String html = service.buildHtmlMessage(interview, true);

    assertTrue(plainText.contains("interview details have been updated"));
    assertTrue(html.contains("Interview Details Updated"));
  }

  private Interview buildInterview() {
    Interview interview = new Interview();
    interview.setCandidateName("Gawrepratik");
    interview.setEmail("gawrepratik@gmail.com");
    interview.setPosition("Associate Software Engineer");
    interview.setDepartment("Development");
    interview.setInterviewDate("2026-07-22");
    interview.setInterviewTime("11:00");
    interview.setInterviewMode("Online");
    interview.setInterviewRound("Technical Round");
    interview.setInterviewer("Meera Nair");
    interview.setMeetingLink("https://meet.example.com/interview");
    interview.setLocation("Google Meet");
    interview.setRemarks("Please keep your resume and portfolio ready.");
    return interview;
  }
}