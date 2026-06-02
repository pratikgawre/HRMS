import DataTable from '../components/DataTable.jsx';
import { useEffect, useState } from 'react';
import { attendanceRows, dashboardStats, leaveRequests, people, tasks } from '../data/dummyData.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, leaveColumns } from './AdminDashboard.jsx';
import { attendanceColumns } from './EmployeeDashboard.jsx';
import { taskColumns } from './Tasks.jsx';
import { loadTasksWithSeed } from '../utils/taskStorage.js';

function TeamLeadDashboard() {
  const [liveTasks, setLiveTasks] = useState([]);

  useEffect(() => {
    let active = true;

    loadTasksWithSeed(tasks).then((rows) => {
      if (active) {
        setLiveTasks(rows);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Hero title="Team Lead Dashboard" copy="Coordinate team attendance, task ownership, leave requests, and day-to-day delivery updates." />
      <QuickActions />
      <CardGrid stats={dashboardStats.teamLead} />
      <div className="dashboard-grid">
        <Section title="Team Tasks" action="Assign Task">
          <DataTable columns={taskColumns} rows={liveTasks.slice(0, 3)} emptyMessage="No tasks available." />
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
