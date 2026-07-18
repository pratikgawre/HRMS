package com.kavya.hrms.controller;

public class TaskStatusRequest {
  private String status;
  private String summary;

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public String getSummary() { return summary; }
  public void setSummary(String summary) { this.summary = summary; }
}
