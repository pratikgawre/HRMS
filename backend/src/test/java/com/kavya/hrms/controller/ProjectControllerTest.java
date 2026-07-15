package com.kavya.hrms.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationService;
import java.util.Optional;
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
}
