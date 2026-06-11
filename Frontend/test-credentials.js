/**
 * Test file to verify credential generation logic
 * Run with: node test-credentials.js
 */

// Simulate the credential generation function
function getEmployeeCredentialNotice(employee) {
  // Generate username: firstName.lastName@kavyainfoweb.com or just firstName@kavyainfoweb.com
  const firstName = (employee.firstName || 'employee').toLowerCase().trim();
  const lastName = (employee.lastName || '').toLowerCase().trim();
  const username = lastName ? `${firstName}.${lastName}` : firstName;
  const loginId = `${username}@kavyainfoweb.com`;
  
  // Generate password: FirstLetterCapital + restLowercase@123
  const passwordBase = (employee.firstName || 'Employee').toLowerCase();
  const password = passwordBase.charAt(0).toUpperCase() + passwordBase.slice(1) + '@123';
  
  return {
    employeeName: employee.displayName || employee.name,
    employeeId: employee.employeeCode || employee.id,
    loginId: loginId,
    password: password,
    accessRole: employee.accessRole || 'Employee',
  };
}

// Test cases
const testCases = [
  {
    name: 'Pratik Sharma',
    employee: {
      firstName: 'Pratik',
      lastName: 'Sharma',
      employeeCode: 'EMP001',
      displayName: 'Pratik Sharma',
      accessRole: 'Employee'
    },
    expectedUsername: 'pratik.sharma@kavyainfoweb.com',
    expectedPassword: 'Pratik@123'
  },
  {
    name: 'Aarav (single name)',
    employee: {
      firstName: 'Aarav',
      lastName: '',
      employeeCode: 'KV001',
      displayName: 'Aarav',
      accessRole: 'Employee'
    },
    expectedUsername: 'aarav@kavyainfoweb.com',
    expectedPassword: 'Aarav@123'
  },
  {
    name: 'John Developer - Team Lead',
    employee: {
      firstName: 'John',
      lastName: 'Developer',
      employeeCode: 'EMP002',
      displayName: 'John Developer',
      accessRole: 'Team Lead'
    },
    expectedUsername: 'john.developer@kavyainfoweb.com',
    expectedPassword: 'John@123'
  },
  {
    name: 'Sarah (Project Manager)',
    employee: {
      firstName: 'Sarah',
      lastName: 'Khan',
      employeeCode: 'EMP003',
      displayName: 'Sarah Khan',
      accessRole: 'Project Manager'
    },
    expectedUsername: 'sarah.khan@kavyainfoweb.com',
    expectedPassword: 'Sarah@123'
  }
];

console.log('🧪 Testing Employee Credential Generation\n');
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

testCases.forEach((testCase) => {
  const credentials = getEmployeeCredentialNotice(testCase.employee);
  
  console.log(`\n📝 ${testCase.name}`);
  console.log(`   Employee ID: ${credentials.employeeId}`);
  console.log(`   Access Role: ${credentials.accessRole}`);
  
  const usernameMatch = credentials.loginId === testCase.expectedUsername;
  const passwordMatch = credentials.password === testCase.expectedPassword;
  
  console.log(`\n   Generated Username: ${credentials.loginId}`);
  console.log(`   Expected Username:  ${testCase.expectedUsername}`);
  console.log(`   ✓ Username Match: ${usernameMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  console.log(`\n   Generated Password: ${credentials.password}`);
  console.log(`   Expected Password:  ${testCase.expectedPassword}`);
  console.log(`   ✓ Password Match: ${passwordMatch ? '✅ PASS' : '❌ FAIL'}`);
  
  if (usernameMatch && passwordMatch) {
    passed++;
  } else {
    failed++;
  }
  
  console.log('-'.repeat(80));
});

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);

if (failed === 0) {
  console.log('✅ All tests passed!');
} else {
  console.log('❌ Some tests failed!');
}
