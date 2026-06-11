import DataTable from '../components/DataTable.jsx';
import { attendanceRows, dashboardStats, leaveRequests, people, tasks } from '../data/dummyData.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, leaveColumns } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import { taskColumns } from './Tasks.jsx';

function TeamLeadDashboard() {
  return (
    <>
      <Hero title="Team Lead Dashboard" copy="Coordinate team attendance, task ownership, leave requests, and day-to-day delivery updates." />
      <QuickActions />
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

export default TeamLeadDashboard;
