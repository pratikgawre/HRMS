import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { attendanceRows, dashboardStats, leaveRequests, tasks } from '../data/dummyData.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, leaveColumns } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import { taskColumns } from './Tasks.jsx';
import { apiRequest, safeApiRequest } from '../utils/api.js';
import { getCurrentEmployeeIdentity } from '../utils/employeeStorage.js';

function TeamLeadDashboard() {
  const currentEmployee = getCurrentEmployeeIdentity();
  const [leaveSummary, setLeaveSummary] = useState({
    totalAllotted: 0,
    totalTaken: 0,
    totalRemaining: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const refreshLeaveSummary = async () => {
      try {
        const summary = await apiRequest('/leaves/summary/current');
        if (!active) {
          return;
        }

        setLeaveSummary(normalizeLeaveSummary(summary));
        setLoading(false);
      } catch {
        const fallback = await safeApiRequest('/leaves/summary/current', null);
        if (!active) {
          return;
        }

        setLeaveSummary(normalizeLeaveSummary(fallback));
        setLoading(false);
      }
    };

    refreshLeaveSummary();
    window.addEventListener('storage', refreshLeaveSummary);
    window.addEventListener('kavyaLeaveRequestsChanged', refreshLeaveSummary);
    const intervalId = window.setInterval(refreshLeaveSummary, 15000);

    return () => {
      active = false;
      window.removeEventListener('storage', refreshLeaveSummary);
      window.removeEventListener('kavyaLeaveRequestsChanged', refreshLeaveSummary);
      window.clearInterval(intervalId);
    };
  }, []);

  const quickActionDetails = useMemo(() => ({
    'Add Employee': currentEmployee.employee || 'My Profile',
    'Approve Leave': loading
      ? 'Loading...'
      : `Total: ${leaveSummary.totalAllotted} | Taken: ${leaveSummary.totalTaken} | Remaining: ${leaveSummary.totalRemaining}`,
    'Run Payroll': 'Due in 6 days',
    'Post Notice': 'All teams',
  }), [currentEmployee.employee, leaveSummary, loading]);

  return (
    <>
      <Hero title="Team Lead Dashboard" copy="Coordinate team attendance, task ownership, leave requests, and day-to-day delivery updates." />
      <QuickActions
        labelOverrides={{
          'Add Employee': 'Employee',
          'Approve Leave': 'Leaves',
        }}
        detailOverrides={quickActionDetails}
        pathOverrides={{
          'Add Employee': '/team-lead/profile',
          'Approve Leave': '/team-lead/leave-review',
        }}
      />
      <CardGrid stats={dashboardStats.teamLead} />
      <div className="dashboard-grid">
        <Section title="Team Tasks" action="Assign Task">
          <DataTable columns={taskColumns} rows={tasks.slice(0, 3)} />
        </Section>
        <Section title="Leave Review" action="Review">
          <DataTable columns={leaveColumns} rows={leaveRequests} />
        </Section>
      </div>
      <Section title="Today Attendance" action="View Team">
        <DataTable columns={attendanceColumns} rows={attendanceRows} />
      </Section>
      <InsightGrid />
    </>
  );
}

function normalizeLeaveSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return {
      totalAllotted: 0,
      totalTaken: 0,
      totalRemaining: 0,
    };
  }

  return {
    totalAllotted: Number(summary.totalAllotted || summary.totalAllocated || 0),
    totalTaken: Number(summary.totalTaken || summary.totalUsed || 0),
    totalRemaining: Number(summary.totalRemaining || 0),
  };
}

export default TeamLeadDashboard;
