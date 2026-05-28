package com.kavya.hrms.controller;

import com.kavya.hrms.model.TaskItem;
import com.kavya.hrms.repository.TaskRepository;
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
@RequestMapping("/api/tasks")
public class TaskController {
  private final TaskRepository taskRepository;

  public TaskController(TaskRepository taskRepository) {
    this.taskRepository = taskRepository;
  }

  @GetMapping
  public List<TaskItem> list() {
    return taskRepository.findAll();
  }

  @PostMapping
  public TaskItem create(@RequestBody TaskItem task) {
    return taskRepository.save(task);
  }

  @PostMapping("/bulk")
  public List<TaskItem> bulkSave(@RequestBody List<TaskItem> tasks) {
    taskRepository.deleteAll();
    return taskRepository.saveAll(tasks);
  }

  @PutMapping("/{id}")
  public TaskItem update(@PathVariable String id, @RequestBody TaskItem task) {
    task.setId(id);
    return taskRepository.save(task);
  }

  @DeleteMapping("/{id}")
  public void delete(@PathVariable String id) {
    taskRepository.deleteById(id);
  }
}
