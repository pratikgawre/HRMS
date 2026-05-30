import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { tasks } from '../data/dummyData.js';
import { getSessionValue } from '../utils/appSession.js';

export const taskColumns = [
  { key: 'id', label: 'Task ID' },
  { key: 'title', label: 'Task' },
  { key: 'owner', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due' },
  { key: 'status', label: 'Status' },
];

function Tasks() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const isHr = role === 'hr';

  return (
    <>
      <Hero
        title={isHr ? 'Task Status Update' : 'Task Assignment'}
        copy={isHr
          ? 'View and monitor task ownership, priority, due date, and current status updates.'
          : 'Assign, monitor, and review team tasks with ownership, priority, due date, and current status.'}
      />
      <Section title="Assigned Tasks" action={isHr ? undefined : 'Assign Task'}>
        <DataTable columns={taskColumns} rows={tasks} />
      </Section>
    </>
  );
}

export default Tasks;
