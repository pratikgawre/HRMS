package com.kavya.hrms.dto;

import com.kavya.hrms.model.Employee;

public record AssetEmployeeDirectoryItem(
    String id,
    String employeeId,
    String employeeCode,
    String userId,
    String email,
    String firstName,
    String middleName,
    String lastName,
    String displayName,
    String name,
    String role,
    String accessRole) {

  public static AssetEmployeeDirectoryItem from(Employee employee) {
    return new AssetEmployeeDirectoryItem(
        employee.getId(),
        employee.getEmployeeId(),
        employee.getEmployeeCode(),
        employee.getUserId(),
        employee.getEmail(),
        employee.getFirstName(),
        employee.getMiddleName(),
        employee.getLastName(),
        employee.getDisplayName(),
        employee.getName(),
        employee.getRole(),
        employee.getAccessRole());
  }
}
