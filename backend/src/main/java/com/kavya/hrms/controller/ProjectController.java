package com.kavya.hrms.controller;

import com.kavya.hrms.model.Project;
import com.kavya.hrms.repository.ProjectRepository;
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
@RequestMapping("/api/projects")
public class ProjectController {
  private final ProjectRepository projectRepository;

  public ProjectController(ProjectRepository projectRepository) {
    this.projectRepository = projectRepository;
  }

  @GetMapping
  public List<Project> list() {
    return projectRepository.findAll();
  }

  @PostMapping
  public Project create(@RequestBody Project project) {
    return projectRepository.save(project);
  }

  @PostMapping("/bulk")
  public List<Project> bulkSave(@RequestBody List<Project> projects) {
    projectRepository.deleteAll();
    return projectRepository.saveAll(projects);
  }

  @PutMapping("/{id}")
  public Project update(@PathVariable String id, @RequestBody Project project) {
    project.setId(id);
    return projectRepository.save(project);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable String id) {
    projectRepository.deleteById(id);
  }
}
