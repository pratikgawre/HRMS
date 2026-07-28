package com.kavya.hrms.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.repository.ProjectRepository;
import com.kavya.hrms.repository.TaskRepository;
import com.kavya.hrms.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

class TaskControllerTest {
  private TaskRepository taskRepository;
  private ProjectRepository projectRepository;
  private EmployeeRepository employeeRepository;
  private NotificationService notificationService;
  private GridFsTemplate gridFsTemplate;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    taskRepository = mock(TaskRepository.class);
    projectRepository = mock(ProjectRepository.class);
    employeeRepository = mock(EmployeeRepository.class);
    notificationService = mock(NotificationService.class);
    gridFsTemplate = mock(GridFsTemplate.class);

    TaskController taskController = new TaskController(
        taskRepository,
        projectRepository,
        employeeRepository,
        notificationService,
        gridFsTemplate);
    mockMvc = MockMvcBuilders.standaloneSetup(taskController).build();
  }

  @Test
  void createTaskShouldRejectInvalidModuleTitle() throws Exception {
    mockMvc.perform(post("/api/tasks")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": "@#$%123",
                  "assignedToId": "EMP-101",
                  "assignedToName": "Priya Menon",
                  "owner": "Priya Menon",
                  "priority": "Medium",
                  "dueDate": "2026-07-30",
                  "status": "Pending"
                }
                """))
        .andExpect(status().isBadRequest());

    verify(taskRepository, never()).save(org.mockito.Mockito.any());
  }

  @Test
  void updateTaskShouldRejectInvalidModuleTitle() throws Exception {
    mockMvc.perform(put("/api/tasks/TSK-1")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "title": "Module@123",
                  "assignedToId": "EMP-101",
                  "assignedToName": "Priya Menon",
                  "owner": "Priya Menon",
                  "priority": "Medium",
                  "dueDate": "2026-07-30",
                  "status": "Pending"
                }
                """))
        .andExpect(status().isBadRequest());

    verify(taskRepository, never()).save(org.mockito.Mockito.any());
  }
}
