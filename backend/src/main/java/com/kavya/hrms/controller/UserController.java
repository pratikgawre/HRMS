package com.kavya.hrms.controller;

import com.kavya.hrms.model.AppUser;
import com.kavya.hrms.repository.AppUserRepository;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
public class UserController {
  private final AppUserRepository appUserRepository;

  public UserController(AppUserRepository appUserRepository) {
    this.appUserRepository = appUserRepository;
  }

  @GetMapping
  public List<AppUser> list() {
    return appUserRepository.findAll();
  }

  @PostMapping("/bulk")
  public List<AppUser> bulkSave(@RequestBody List<AppUser> users) {
    return appUserRepository.saveAll(users);
  }
}
