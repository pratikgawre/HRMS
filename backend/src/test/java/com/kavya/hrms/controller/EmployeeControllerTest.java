package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.EmployeeWelcomeEmailService;
import com.kavya.hrms.service.NotificationService;

@ExtendWith(MockitoExtension.class)
class EmployeeControllerTest {
  @Mock
  private EmployeeRepository employeeRepository;

  @Mock
  private AppUserRepository appUserRepository;

  @Mock
  private NotificationService notificationService;

  @Mock
  private EmployeeWelcomeEmailService employeeWelcomeEmailService;

  @InjectMocks
  private EmployeeController employeeController;

  @Test
  @SuppressWarnings("null")
  void updateShouldResetLinkedUserCredentialsAndSendCredentialEmail() {
    Employee employee = buildEmployee("KV009", "Riya", "Shah", "Engineering");
    AppUser user = new AppUser();
    user.setUserId("USR-KV009");
    user.setEmployeeId("KV009");
    user.setEmail("old.login@kavyainfoweb.com");
    user.setPassword("oldPassword123");
    user.setPasswordResetToken("123456");
    user.setPasswordResetTokenExpiresAt("2099-01-01T00:00:00Z");
    user.setMustChangePassword(false);

    doReturn(employee).when(employeeRepository).save(employee);
    when(appUserRepository.findAll()).thenReturn(java.util.Collections.singletonList(user));
    doReturn(user).when(appUserRepository).save(user);
    when(employeeWelcomeEmailService.buildLoginEmail(any(Employee.class))).thenReturn("riya.shah@kavyainfoweb.com");
    when(employeeWelcomeEmailService.buildTemporaryPassword(any(Employee.class))).thenReturn("Riya@123");

    Employee saved = employeeController.update("KV009", employee, "HR Manager", "HR-001");

    assertEquals("KV009", saved.getEmployeeId());
    assertEquals("riya.shah@kavyainfoweb.com", user.getEmail());
    assertEquals("Riya@123", user.getPassword());
    assertNotNull(user.getPasswordHash());
    assertTrue(!user.getPasswordHash().isBlank());
    assertTrue(Boolean.TRUE.equals(user.getMustChangePassword()));
    assertNull(user.getPasswordResetToken());
    assertNull(user.getPasswordResetTokenExpiresAt());
    verify(appUserRepository).save(user);
    verify(employeeWelcomeEmailService).sendCredentialUpdateEmail(saved);
  }

  @Test
  @SuppressWarnings("null")
  void bulkSaveShouldSendCredentialUpdateOnlyForRequestedEmployee() {
    Employee existingTarget = buildEmployee("KV009", "Riya", "Shah", "Engineering");
    Employee existingOther = buildEmployee("KV010", "Arjun", "Mehta", "Engineering");
    Employee updatedTarget = buildEmployee("KV009", "Riya", "Shah", "Quality");
    Employee updatedOther = buildEmployee("KV010", "Arjun", "Mehta", "Finance");
    AppUser targetUser = new AppUser();
    targetUser.setUserId("USR-KV009");
    targetUser.setEmployeeId("KV009");
    targetUser.setEmail("old.riya@kavyainfoweb.com");

    when(employeeRepository.findAll()).thenReturn(java.util.Arrays.asList(existingTarget, existingOther));
    doReturn(java.util.Arrays.asList(updatedTarget, updatedOther))
        .when(employeeRepository).saveAll(java.util.Arrays.asList(updatedTarget, updatedOther));
    when(appUserRepository.findAll()).thenReturn(java.util.Collections.singletonList(targetUser));
    doReturn(targetUser).when(appUserRepository).save(targetUser);
    when(employeeWelcomeEmailService.buildLoginEmail(any(Employee.class))).thenReturn("riya.shah@kavyainfoweb.com");
    when(employeeWelcomeEmailService.buildTemporaryPassword(any(Employee.class))).thenReturn("Riya@123");

    employeeController.bulkSave(
        java.util.Arrays.asList(updatedTarget, updatedOther),
        "HR Manager",
        "HR-001",
        "true",
        "KV009");

    verify(employeeWelcomeEmailService).sendCredentialUpdateEmail(updatedTarget);
    verify(employeeWelcomeEmailService, never()).sendCredentialUpdateEmail(updatedOther);
    assertEquals("Riya@123", targetUser.getPassword());
    assertTrue(Boolean.TRUE.equals(targetUser.getMustChangePassword()));
  }

  private Employee buildEmployee(String employeeCode, String firstName, String lastName, String department) {
    Employee employee = new Employee();
    employee.setEmployeeId(employeeCode);
    employee.setEmployeeCode(employeeCode);
    employee.setId(employeeCode);
    employee.setFirstName(firstName);
    employee.setLastName(lastName);
    employee.setDisplayName(firstName + " " + lastName);
    employee.setEmail(firstName.toLowerCase() + ".personal@example.com");
    employee.setDepartment(department);
    employee.setJobTitle("Developer");
    employee.setAccessRole("Employee");
    employee.setStatus("Active");
    return employee;
  }
}
