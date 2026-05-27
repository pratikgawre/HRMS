import DataTable from '../components/DataTable.jsx';
import { CardGrid, Hero, InsightGrid, QuickActions, Section, employeeColumns, leaveColumns } from './AdminDashboard.jsx';
import { dashboardStats, leaveRequests, people } from '../data/dummyData.js';

function HRDashboard() {
  return (
    <>
      <Hero title="HR Dashboard" copy="Stay close to hiring, attendance, employee engagement, and requests that need a human touch." />
      <QuickActions />
      <CardGrid stats={dashboardStats.hr} />
      <div className="dashboard-grid">
        <Section title="Recently Active Employees" action="Manage">
          <DataTable columns={employeeColumns} rows={people} />
        </Section>
        <Section title="Leave Approval" action="Review">
          <DataTable columns={leaveColumns} rows={leaveRequests} />
        </Section>
      </div>
      <InsightGrid />
    </>
  );
}

export default HRDashboard;
