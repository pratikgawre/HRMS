import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { tasks } from '../data/dummyData.js';
import { getSessionValue } from '../utils/appSession.js';
import { loadTasksWithSeed } from '../utils/taskStorage.js';

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
  const showAssignAction = role !== 'hr';
  const [taskRows, setTaskRows] = useState([]);

  useEffect(() => {
    let active = true;

    loadTasksWithSeed(tasks).then((rows) => {
      if (active) {
        setTaskRows(rows);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Hero
        title={isHr ? 'Tasks' : 'Task Assignment'}
        copy={isHr
          ? 'View team tasks with ownership, priority, due date, and current status.'
          : 'Assign, monitor, and review team tasks with ownership, priority, due date, and current status.'}
      />
      <Section title="Assigned Tasks" action={showAssignAction ? 'Assign Task' : undefined}>
        <DataTable columns={taskColumns} rows={taskRows} emptyMessage="No tasks available." />
      </Section>
    </>
  );
}

export default Tasks;
