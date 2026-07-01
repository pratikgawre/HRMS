package com.kavya.hrms.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Transient;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "employees")
public class Employee {
  @Id
  private String employeeId;
  private String id;
  private String userId;
  private String employeeCode;
  private String profilePicture;
  private String firstName;
  private String middleName;
  private String lastName;
  private String displayName;
  private String name;
  private String avatar;
  private String gender;
  private String dateOfBirth;
  private String bloodGroup;
  private String mobileNo;
  private String phone;
  private String email;
  private String maritalStatus;
  private String nationality;
  private String highestQualification;
  private String physicallyChallenged;
  private String joiningDate;
  private String managerId;
  private String workingLocation;
  private String employmentType;
  private String department;
  private String jobTitle;
  private String accessRole;
  private String role;
  private String grade;
  private String employmentBackground;
  private String status;
  private String aadhaarCardNo;
  private String panCardNo;
  private String aadhaarDocument;
  private String panDocument;
  private String pfUanNo;
  private String esiNo;
  private String permanentAddressLine1;
  private String permanentAddressLine2;
  private String permanentAddressLine3;
  private String permanentAddressLine4;
  private String permanentAddressLine5;
  private String permanentCityDistrict;
  private String permanentPinCode;
  private String permanentState;
  private String permanentCountry;
  private String presentAddressLine1;
  private String presentAddressLine2;
  private String presentAddressLine3;
  private String presentAddressLine4;
  private String presentAddressLine5;
  private String presentCityDistrict;
  private String presentPinCode;
  private String presentState;
  private String presentCountry;
  private String bankName;
  private String accountType;
  private String accountNo;
  private String ifscCode;
  private String packageAmount;
  @Transient
  private Boolean credentialEmailConfigured;
  @Transient
  private Boolean credentialEmailSent;
  @Transient
  private String credentialEmailMessage;

  public String getEmployeeId() { return employeeId; }
  public void setEmployeeId(String employeeId) { this.employeeId = employeeId; }
  public String getId() { return id; }
  public void setId(String id) { this.id = id; }
  public String getUserId() { return userId; }
  public void setUserId(String userId) { this.userId = userId; }
  public String getEmployeeCode() { return employeeCode; }
  public void setEmployeeCode(String employeeCode) { this.employeeCode = employeeCode; }
  public String getProfilePicture() { return profilePicture; }
  public void setProfilePicture(String profilePicture) { this.profilePicture = profilePicture; }
  public String getFirstName() { return firstName; }
  public void setFirstName(String firstName) { this.firstName = firstName; }
  public String getMiddleName() { return middleName; }
  public void setMiddleName(String middleName) { this.middleName = middleName; }
  public String getLastName() { return lastName; }
  public void setLastName(String lastName) { this.lastName = lastName; }
  public String getDisplayName() { return displayName; }
  public void setDisplayName(String displayName) { this.displayName = displayName; }
  public String getName() { return name; }
  public void setName(String name) { this.name = name; }
  public String getAvatar() { return avatar; }
  public void setAvatar(String avatar) { this.avatar = avatar; }
  public String getGender() { return gender; }
  public void setGender(String gender) { this.gender = gender; }
  public String getDateOfBirth() { return dateOfBirth; }
  public void setDateOfBirth(String dateOfBirth) { this.dateOfBirth = dateOfBirth; }
  public String getBloodGroup() { return bloodGroup; }
  public void setBloodGroup(String bloodGroup) { this.bloodGroup = bloodGroup; }
  public String getMobileNo() { return mobileNo; }
  public void setMobileNo(String mobileNo) { this.mobileNo = mobileNo; }
  public String getPhone() { return phone; }
  public void setPhone(String phone) { this.phone = phone; }
  public String getEmail() { return email; }
  public void setEmail(String email) { this.email = email; }
  public String getMaritalStatus() { return maritalStatus; }
  public void setMaritalStatus(String maritalStatus) { this.maritalStatus = maritalStatus; }
  public String getNationality() { return nationality; }
  public void setNationality(String nationality) { this.nationality = nationality; }
  public String getHighestQualification() { return highestQualification; }
  public void setHighestQualification(String highestQualification) { this.highestQualification = highestQualification; }
  public String getPhysicallyChallenged() { return physicallyChallenged; }
  public void setPhysicallyChallenged(String physicallyChallenged) { this.physicallyChallenged = physicallyChallenged; }
  public String getJoiningDate() { return joiningDate; }
  public void setJoiningDate(String joiningDate) { this.joiningDate = joiningDate; }
  public String getManagerId() { return managerId; }
  public void setManagerId(String managerId) { this.managerId = managerId; }
  public String getWorkingLocation() { return workingLocation; }
  public void setWorkingLocation(String workingLocation) { this.workingLocation = workingLocation; }
  public String getEmploymentType() { return employmentType; }
  public void setEmploymentType(String employmentType) { this.employmentType = employmentType; }
  public String getDepartment() { return department; }
  public void setDepartment(String department) { this.department = department; }
  public String getJobTitle() { return jobTitle; }
  public void setJobTitle(String jobTitle) { this.jobTitle = jobTitle; }
  public String getAccessRole() { return accessRole; }
  public void setAccessRole(String accessRole) { this.accessRole = accessRole; }
  public String getRole() { return role; }
  public void setRole(String role) { this.role = role; }
  public String getGrade() { return grade; }
  public void setGrade(String grade) { this.grade = grade; }
  public String getEmploymentBackground() { return employmentBackground; }
  public void setEmploymentBackground(String employmentBackground) { this.employmentBackground = employmentBackground; }
  public String getStatus() { return status; }
  public void setStatus(String status) { this.status = status; }
  public String getAadhaarCardNo() { return aadhaarCardNo; }
  public void setAadhaarCardNo(String aadhaarCardNo) { this.aadhaarCardNo = aadhaarCardNo; }
  public String getPanCardNo() { return panCardNo; }
  public void setPanCardNo(String panCardNo) { this.panCardNo = panCardNo; }
  public String getAadhaarDocument() { return aadhaarDocument; }
  public void setAadhaarDocument(String aadhaarDocument) { this.aadhaarDocument = aadhaarDocument; }
  public String getPanDocument() { return panDocument; }
  public void setPanDocument(String panDocument) { this.panDocument = panDocument; }
  public String getPfUanNo() { return pfUanNo; }
  public void setPfUanNo(String pfUanNo) { this.pfUanNo = pfUanNo; }
  public String getEsiNo() { return esiNo; }
  public void setEsiNo(String esiNo) { this.esiNo = esiNo; }
  public String getPermanentAddressLine1() { return permanentAddressLine1; }
  public void setPermanentAddressLine1(String permanentAddressLine1) { this.permanentAddressLine1 = permanentAddressLine1; }
  public String getPermanentAddressLine2() { return permanentAddressLine2; }
  public void setPermanentAddressLine2(String permanentAddressLine2) { this.permanentAddressLine2 = permanentAddressLine2; }
  public String getPermanentAddressLine3() { return permanentAddressLine3; }
  public void setPermanentAddressLine3(String permanentAddressLine3) { this.permanentAddressLine3 = permanentAddressLine3; }
  public String getPermanentAddressLine4() { return permanentAddressLine4; }
  public void setPermanentAddressLine4(String permanentAddressLine4) { this.permanentAddressLine4 = permanentAddressLine4; }
  public String getPermanentAddressLine5() { return permanentAddressLine5; }
  public void setPermanentAddressLine5(String permanentAddressLine5) { this.permanentAddressLine5 = permanentAddressLine5; }
  public String getPermanentCityDistrict() { return permanentCityDistrict; }
  public void setPermanentCityDistrict(String permanentCityDistrict) { this.permanentCityDistrict = permanentCityDistrict; }
  public String getPermanentPinCode() { return permanentPinCode; }
  public void setPermanentPinCode(String permanentPinCode) { this.permanentPinCode = permanentPinCode; }
  public String getPermanentState() { return permanentState; }
  public void setPermanentState(String permanentState) { this.permanentState = permanentState; }
  public String getPermanentCountry() { return permanentCountry; }
  public void setPermanentCountry(String permanentCountry) { this.permanentCountry = permanentCountry; }
  public String getPresentAddressLine1() { return presentAddressLine1; }
  public void setPresentAddressLine1(String presentAddressLine1) { this.presentAddressLine1 = presentAddressLine1; }
  public String getPresentAddressLine2() { return presentAddressLine2; }
  public void setPresentAddressLine2(String presentAddressLine2) { this.presentAddressLine2 = presentAddressLine2; }
  public String getPresentAddressLine3() { return presentAddressLine3; }
  public void setPresentAddressLine3(String presentAddressLine3) { this.presentAddressLine3 = presentAddressLine3; }
  public String getPresentAddressLine4() { return presentAddressLine4; }
  public void setPresentAddressLine4(String presentAddressLine4) { this.presentAddressLine4 = presentAddressLine4; }
  public String getPresentAddressLine5() { return presentAddressLine5; }
  public void setPresentAddressLine5(String presentAddressLine5) { this.presentAddressLine5 = presentAddressLine5; }
  public String getPresentCityDistrict() { return presentCityDistrict; }
  public void setPresentCityDistrict(String presentCityDistrict) { this.presentCityDistrict = presentCityDistrict; }
  public String getPresentPinCode() { return presentPinCode; }
  public void setPresentPinCode(String presentPinCode) { this.presentPinCode = presentPinCode; }
  public String getPresentState() { return presentState; }
  public void setPresentState(String presentState) { this.presentState = presentState; }
  public String getPresentCountry() { return presentCountry; }
  public void setPresentCountry(String presentCountry) { this.presentCountry = presentCountry; }
  public String getBankName() { return bankName; }
  public void setBankName(String bankName) { this.bankName = bankName; }
  public String getAccountType() { return accountType; }
  public void setAccountType(String accountType) { this.accountType = accountType; }
  public String getAccountNo() { return accountNo; }
  public void setAccountNo(String accountNo) { this.accountNo = accountNo; }
  public String getIfscCode() { return ifscCode; }
  public void setIfscCode(String ifscCode) { this.ifscCode = ifscCode; }
  public String getPackageAmount() { return packageAmount; }
  public void setPackageAmount(String packageAmount) { this.packageAmount = packageAmount; }
  public Boolean getCredentialEmailConfigured() { return credentialEmailConfigured; }
  public void setCredentialEmailConfigured(Boolean credentialEmailConfigured) { this.credentialEmailConfigured = credentialEmailConfigured; }
  public Boolean getCredentialEmailSent() { return credentialEmailSent; }
  public void setCredentialEmailSent(Boolean credentialEmailSent) { this.credentialEmailSent = credentialEmailSent; }
  public String getCredentialEmailMessage() { return credentialEmailMessage; }
  public void setCredentialEmailMessage(String credentialEmailMessage) { this.credentialEmailMessage = credentialEmailMessage; }
}
