package com.kavya.hrms.controller;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;

@WebMvcTest(ProjectController.class)
class ProjectControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ProjectRepository projectRepository;

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
