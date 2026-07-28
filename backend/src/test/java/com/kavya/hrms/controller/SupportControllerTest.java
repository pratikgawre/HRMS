package com.kavya.hrms.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.SupportTicketRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@SuppressWarnings("all")
class SupportControllerTest {
  private SupportTicketRepository repository;
  private EmployeeRepository employeeRepository;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    repository = mock(SupportTicketRepository.class);
    employeeRepository = mock(EmployeeRepository.class);
    SupportController controller = new SupportController(repository, employeeRepository);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void shouldRejectTicketTitleWithSpecialCharacters() throws Exception {
    mockMvc.perform(post("/api/support")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "employeeId": "EMP-1",
                  "employeeName": "Test User",
                  "employeeEmail": "test@example.com",
                  "employeeRole": "employee",
                  "employeeDepartment": "IT",
                  "title": "@#$%123",
                  "category": "Login Issue",
                  "priority": "Medium",
                  "description": "This is a valid support ticket description."
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Validation failed"))
        .andExpect(jsonPath("$.fieldErrors.title").exists());

    verify(repository, never()).save(org.mockito.Mockito.any());
  }
}
