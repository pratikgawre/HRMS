import DataTable from '../components/DataTable.jsx';
import { Hero, Section, employeeColumns } from './AdminDashboard.jsx';
import { people } from '../data/dummyData.js';

function MyTeam() {
  return (
    <>
      <Hero title="My Team" copy="View team members, reporting roles, departments, and current working status." />
      <Section title="Team Members" action="Message Team">
        <DataTable columns={employeeColumns} rows={people} />
      </Section>
    </>
  );
}

export default MyTeam;
