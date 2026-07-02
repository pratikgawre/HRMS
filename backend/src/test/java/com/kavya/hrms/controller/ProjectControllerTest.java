package com.kavya.hrms.controller;

import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SuppressWarnings("all")
class ProjectControllerTest {

    private MockMvc mockMvc;

    @Mock
    private ProjectRepository projectRepository;

    @InjectMocks
    private ProjectController projectController;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
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
