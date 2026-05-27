package com.kavya.hrms.controller;

import com.kavya.hrms.model.Employee;
import com.kavya.hrms.repository.EmployeeRepository;
import java.util.List;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/employees")
public class EmployeeController {
  private final EmployeeRepository employeeRepository;

  public EmployeeController(EmployeeRepository employeeRepository) {
    this.employeeRepository = employeeRepository;
  }

  @GetMapping
  public List<Employee> list() {
    return employeeRepository.findAll();
  }

  @PostMapping
  public Employee create(@RequestBody Employee employee) {
    return employeeRepository.save(employee);
  }

  @PostMapping("/bulk")
  public List<Employee> bulkSave(@RequestBody List<Employee> employees) {
    employeeRepository.deleteAll();
    return employeeRepository.saveAll(employees);
  }

  @PutMapping("/{employeeId}")
  public Employee update(@PathVariable String employeeId, @RequestBody Employee employee) {
    employee.setEmployeeId(employeeId);
    return employeeRepository.save(employee);
  }

  @DeleteMapping("/{employeeId}")
  public void delete(@PathVariable String employeeId) {
    employeeRepository.deleteById(employeeId);
  }
}
