import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { tasks } from '../data/dummyData.js';

export const taskColumns = [
  { key: 'id', label: 'Task ID' },
  { key: 'title', label: 'Task' },
  { key: 'owner', label: 'Assignee' },
  { key: 'priority', label: 'Priority' },
  { key: 'due', label: 'Due' },
  { key: 'status', label: 'Status' },
];

function Tasks() {
  return (
    <>
      <Hero title="Task Assignment" copy="Assign, monitor, and review team tasks with ownership, priority, due date, and current status." />
      <Section title="Assigned Tasks" action="Assign Task">
        <DataTable columns={taskColumns} rows={tasks} />
      </Section>
    </>
  );
}

export default Tasks;
