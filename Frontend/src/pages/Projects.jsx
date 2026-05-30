import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { projects } from '../data/dummyData.js';
import { getSessionValue } from '../utils/appSession.js';

export const projectColumns = [
  { key: 'id', label: 'Project ID' },
  { key: 'name', label: 'Project' },
  { key: 'manager', label: 'Manager' },
  { key: 'team', label: 'Team' },
  { key: 'progress', label: 'Progress' },
  { key: 'status', label: 'Status' },
];

function Projects() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const isHr = role === 'hr';

  return (
    <>
      <Hero
        title={isHr ? 'Project List' : 'Projects'}
        copy={isHr
          ? 'View project health, owners, team size, progress, and current delivery status.'
          : 'Manage project health, owners, team size, progress, and current delivery status.'}
      />
      <Section title="Project Portfolio" action={isHr ? undefined : 'Create Project'}>
        <DataTable columns={projectColumns} rows={projects} />
      </Section>
    </>
  );
}

export default Projects;
