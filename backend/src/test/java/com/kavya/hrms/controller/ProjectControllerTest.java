package com.kavya.hrms.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationService;
import java.util.Optional;
import org.springframework.http.MediaType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@SuppressWarnings("all")
class ProjectControllerTest {
  private ProjectRepository projectRepository;
  private NotificationService notificationService;
  private MockMvc mockMvc;

  @BeforeEach
  @SuppressWarnings("unused")
  void setUp() {
    projectRepository = mock(ProjectRepository.class);
    notificationService = mock(NotificationService.class);
    ProjectController projectController = new ProjectController(projectRepository, notificationService);
    mockMvc = MockMvcBuilders.standaloneSetup(projectController).build();
  }

  @Test
  void deleteProjectEndpointShouldResolvePathVariable() throws Exception {
    Project project = new Project();
    project.setId("proj-1");
    project.setName("Alpha");

    when(projectRepository.findById("proj-1")).thenReturn(Optional.of(project));

    mockMvc.perform(delete("/api/projects/proj-1"))
        .andExpect(status().isOk());

    verify(projectRepository).deleteById("proj-1");
  }

  @Test
  void createProjectShouldRejectInvalidProjectName() throws Exception {
    mockMvc.perform(post("/api/projects")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "!!@#$%^123",
                  "manager": "Priya Menon",
                  "managerId": "EMP-100",
                  "teamLeadId": "TL001",
                  "status": "Planning"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Validation failed"))
        .andExpect(jsonPath("$.fieldErrors.name").exists());

    verify(projectRepository, never()).save(org.mockito.Mockito.any());
  }

  @Test
  void updateProjectShouldRejectInvalidManagerId() throws Exception {
    mockMvc.perform(put("/api/projects/proj-1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "name": "Employee Portal",
                  "manager": "Priya Menon",
                  "managerId": "###@@@",
                  "teamLeadId": "TL001",
                  "status": "Active"
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.managerId").exists());

    verify(projectRepository, never()).save(org.mockito.Mockito.any());
  }
}
