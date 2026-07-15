package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "interviews")
public class Interview {
  @Id
  private String id;
  private String candidateName;
  private String email;
  private String phone;
  private String position;
  private String department;
  private String experience;
  private String currentCompany;
  private String currentCTC;
  private String expectedCTC;
  private String resumeFile;
  private String resumeFileName;
  private String resumeSource;
  private String referenceName;
  private String priority;
  private String interviewDate;
  private String interviewTime;
  private String interviewMode;
  private String interviewRound;
  private String interviewer;
  private String meetingLink;
  private String location;
  private String status;
  private String remarks;
  private boolean sharedWithAdmin;
  private String createdBy;
  private String createdDate;
  private String updatedDate;

  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getCandidateName() { return candidateName; }
  public void setCandidateName(String candidateName) { this.candidateName = candidateName; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }
  public String getPosition() { return position; }
  public void setPosition(String position) { this.position = position; }
  public String getDepartment() { return department; }
  public void setDepartment(String department) { this.department = department; }
  public String getExperience() { return experience; }
  public void setExperience(String experience) { this.experience = experience; }
  public String getCurrentCompany() { return currentCompany; }
  public void setCurrentCompany(String currentCompany) { this.currentCompany = currentCompany; }
  public String getCurrentCTC() { return currentCTC; }
  public void setCurrentCTC(String currentCTC) { this.currentCTC = currentCTC; }
  public String getExpectedCTC() { return expectedCTC; }
  public void setExpectedCTC(String expectedCTC) { this.expectedCTC = expectedCTC; }
  public String getResumeFile() { return resumeFile; }
  public void setResumeFile(String resumeFile) { this.resumeFile = resumeFile; }
  public String getResumeFileName() { return resumeFileName; }
  public void setResumeFileName(String resumeFileName) { this.resumeFileName = resumeFileName; }
  public String getResumeSource() { return resumeSource; }
  public void setResumeSource(String resumeSource) { this.resumeSource = resumeSource; }
  public String getReferenceName() { return referenceName; }
  public void setReferenceName(String referenceName) { this.referenceName = referenceName; }
  public String getPriority() { return priority; }
  public void setPriority(String priority) { this.priority = priority; }
  public String getInterviewDate() { return interviewDate; }
  public void setInterviewDate(String interviewDate) { this.interviewDate = interviewDate; }
  public String getInterviewTime() { return interviewTime; }
  public void setInterviewTime(String interviewTime) { this.interviewTime = interviewTime; }
  public String getInterviewMode() { return interviewMode; }
  public void setInterviewMode(String interviewMode) { this.interviewMode = interviewMode; }
  public String getInterviewRound() { return interviewRound; }
  public void setInterviewRound(String interviewRound) { this.interviewRound = interviewRound; }
  public String getInterviewer() { return interviewer; }
  public void setInterviewer(String interviewer) { this.interviewer = interviewer; }
  public String getMeetingLink() { return meetingLink; }
  public void setMeetingLink(String meetingLink) { this.meetingLink = meetingLink; }
  public String getLocation() { return location; }
  public void setLocation(String location) { this.location = location; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getRemarks() { return remarks; }
  public void setRemarks(String remarks) { this.remarks = remarks; }
  public boolean isSharedWithAdmin() { return sharedWithAdmin; }
  public void setSharedWithAdmin(boolean sharedWithAdmin) { this.sharedWithAdmin = sharedWithAdmin; }
  public String getCreatedBy() { return createdBy; }
  public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
  public String getCreatedDate() { return createdDate; }
  public void setCreatedDate(String createdDate) { this.createdDate = createdDate; }
  public String getUpdatedDate() { return updatedDate; }
  public void setUpdatedDate(String updatedDate) { this.updatedDate = updatedDate; }
}
