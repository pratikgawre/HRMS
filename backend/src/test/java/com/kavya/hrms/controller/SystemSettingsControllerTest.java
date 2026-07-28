package com.kavya.hrms.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.kavya.hrms.repository.SystemSettingsRepository;
import com.kavya.hrms.websocket.SettingsBroadcastService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

@SuppressWarnings("all")
class SystemSettingsControllerTest {
  private SystemSettingsRepository repository;
  private SettingsBroadcastService broadcastService;
  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    repository = mock(SystemSettingsRepository.class);
    broadcastService = mock(SettingsBroadcastService.class);
    SystemSettingsController controller = new SystemSettingsController(repository, broadcastService);
    mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
  }

  @Test
  void shouldRejectInvalidDepartmentNames() throws Exception {
    mockMvc.perform(put("/api/settings")
            .header("X-Kavya-Access-Role", "admin")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "departments": ["HR", "Eng1neering", "Finance"],
                  "designations": ["HR Manager"],
                  "leaveTypes": [{"name":"Casual Leave","days":12}],
                  "payrollSettings": {"Pay Cycle":"Monthly"}
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message").value("Validation failed"))
        .andExpect(jsonPath("$.fieldErrors.departments").exists());

    verify(repository, never()).save(org.mockito.Mockito.any());
    verify(broadcastService, never()).broadcastSettingsChanged(org.mockito.Mockito.any());
  }

  @Test
  void shouldRejectInvalidPayrollConfigurationText() throws Exception {
    mockMvc.perform(put("/api/settings")
            .header("X-Kavya-Access-Role", "admin")
            .contentType(MediaType.APPLICATION_JSON)
            .content("""
                {
                  "departments": ["HR"],
                  "designations": ["HR Manager"],
                  "leaveTypes": [{"name":"Casual Leave","days":12}],
                  "payrollSettings": {"Pay Cycle":"!!!@@@"}
                }
                """))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.fieldErrors.payrollSettings").exists());

    verify(repository, never()).save(org.mockito.Mockito.any());
    verify(broadcastService, never()).broadcastSettingsChanged(org.mockito.Mockito.any());
  }
}
