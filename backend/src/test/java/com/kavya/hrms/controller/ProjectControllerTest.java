package com.kavya.hrms.controller;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.service.NotificationService;

@WebMvcTest(ProjectController.class)
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjectRepository projectRepository;

    @MockitoBean
    private NotificationService notificationService;

    @Test
    void deleteProjectEndpointShouldResolvePathVariable() throws Exception {
        Project project = new Project();
        project.setId("proj-1");
        project.setName("Alpha");

        assertNotNull(notificationService);
        when(projectRepository.findById("proj-1")).thenReturn(Optional.of(project));

        mockMvc.perform(delete("/api/projects/proj-1"))
                .andExpect(status().isOk());

        verify(projectRepository).deleteById("proj-1");
    }
}
