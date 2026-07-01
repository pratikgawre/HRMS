package com.kavya.hrms.controller;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.repository.EmployeeRepository;
import com.kavya.hrms.service.NotificationService;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EmployeeControllerTest {
  @Mock
  private EmployeeRepository employeeRepository;

  @Mock
  private NotificationService notificationService;

  @InjectMocks
  private EmployeeController employeeController;

  @Test
  void updateShouldSetEmployeeIdAndNotify() {
    Employee employee = buildEmployee("KV009", "Riya", "Shah", "Engineering");
    doReturn(employee).when(employeeRepository).save(employee);

    Employee saved = employeeController.update("KV009", employee, "HR Manager", "HR-001");

    assertEquals("KV009", saved.getEmployeeId());
    verify(employeeRepository).save(employee);
    verify(notificationService).notifyRoles(
        List.of("admin", "hr"),
        "Employee profile updated",
        "Riya Shah was updated in Engineering.",
        "employee",
        "KV009",
        "HR Manager",
        "System",
        "HR-001");
  }

  @Test
  void bulkSaveShouldSaveAllAndNotifyWhenRecordsAlreadyExist() {
    Employee existingTarget = buildEmployee("KV009", "Riya", "Shah", "Engineering");
    Employee existingOther = buildEmployee("KV010", "Arjun", "Mehta", "Engineering");
    Employee updatedTarget = buildEmployee("KV009", "Riya", "Shah", "Quality");
    Employee updatedOther = buildEmployee("KV010", "Arjun", "Mehta", "Finance");

    List<Employee> input = Arrays.asList(updatedTarget, updatedOther);
    when(employeeRepository.count()).thenReturn(2L);
    when(employeeRepository.findAll()).thenReturn(Arrays.asList(existingTarget, existingOther));
    doReturn(Arrays.asList(updatedTarget, updatedOther)).when(employeeRepository).saveAll(input);

    List<Employee> saved = employeeController.bulkSave(input, "HR Manager", "HR-001");

    assertEquals(2, saved.size());
    assertEquals("KV009", saved.get(0).getEmployeeId());
    assertEquals("KV010", saved.get(1).getEmployeeId());
    verify(employeeRepository).saveAll(input);
    verify(notificationService).notifyRoles(
        List.of("admin", "hr"),
        "Employee records refreshed",
        "Employee profiles were updated in bulk.",
        "employee",
        "bulk",
        "HR Manager",
        "System",
        "HR-001");
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
