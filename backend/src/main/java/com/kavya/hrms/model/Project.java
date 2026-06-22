package com.kavya.hrms.model;

import java.util.List;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "projects")
public class Project {
  @Id
  private String id;
  private String name;
  private String description;
  private String manager;
  private String managerId;

  private String teamLead;          // KEEP THIS
  private String teamLeadId;
  private String teamLeadName;
  private String teamLeadDesignation;

  private String team;
  private List<String> teamMembers;
  private List<ProjectMember> teamMemberDetails;

  private String milestone;
  private String startDate;
  private String endDate;
  private String progress;
  private String status;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }

  public String getName() { return name; }
  public void setName(String name) { this.name = name; }

  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }

  public String getManager() { return manager; }
  public void setManager(String manager) { this.manager = manager; }

  public String getManagerId() { return managerId; }
  public void setManagerId(String managerId) { this.managerId = managerId; }

  public String getTeamLead() { return teamLead; }
  public void setTeamLead(String teamLead) { this.teamLead = teamLead; }

  public String getTeamLeadId() { return teamLeadId; }
  public void setTeamLeadId(String teamLeadId) { this.teamLeadId = teamLeadId; }

  public String getTeamLeadName() { return teamLeadName; }
  public void setTeamLeadName(String teamLeadName) { this.teamLeadName = teamLeadName; }

  public String getTeamLeadDesignation() { return teamLeadDesignation; }
  public void setTeamLeadDesignation(String teamLeadDesignation) { this.teamLeadDesignation = teamLeadDesignation; }

  public String getTeam() { return team; }
  public void setTeam(String team) { this.team = team; }

  public List<String> getTeamMembers() { return teamMembers; }
  public void setTeamMembers(List<String> teamMembers) { this.teamMembers = teamMembers; }

  public List<ProjectMember> getTeamMemberDetails() { return teamMemberDetails; }
  public void setTeamMemberDetails(List<ProjectMember> teamMemberDetails) { this.teamMemberDetails = teamMemberDetails; }

  public String getMilestone() { return milestone; }
  public void setMilestone(String milestone) { this.milestone = milestone; }

  public String getStartDate() { return startDate; }
  public void setStartDate(String startDate) { this.startDate = startDate; }

  public String getEndDate() { return endDate; }
  public void setEndDate(String endDate) { this.endDate = endDate; }

  public String getProgress() { return progress; }
  public void setProgress(String progress) { this.progress = progress; }

  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
}