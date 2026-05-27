import DataTable from '../components/DataTable.jsx';
import { dashboardStats, projects, tasks } from '../data/dummyData.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section } from './AdminDashboard.jsx';
import { projectColumns } from './Projects.jsx';
import { taskColumns } from './Tasks.jsx';

function ProjectManagerDashboard() {
  return (
    <>
      <Hero title="Project Manager Dashboard" copy="Track project progress, milestones, delivery tasks, and team capacity in one workspace." />
      <QuickActions />
      <CardGrid stats={dashboardStats.projectManager} />
      <div className="dashboard-grid">
        <Section title="Active Projects" action="New Project">
          <DataTable columns={projectColumns} rows={projects} />
        </Section>
        <Section title="Delivery Tasks" action="Assign">
          <DataTable columns={taskColumns} rows={tasks.slice(0, 3)} />
        </Section>
      </div>
      <InsightGrid />
    </>
  );
}

export default ProjectManagerDashboard;
