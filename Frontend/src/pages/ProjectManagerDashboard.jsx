import { useEffect, useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import { apiRequest } from '../utils/api.js';
import { people, tasks as fallbackTasks } from '../data/dummyData.js';
import { dashboardStats } from '../data/dummyData.js';
import { CardGrid, Hero, InsightGrid, QuickActions, Section } from './AdminDashboard.jsx';
import { projectColumns } from './Projects.jsx';
import { taskColumns } from './Tasks.jsx';

function ProjectManagerDashboard() {
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadProjects = () => {
      apiRequest('/projects')
        .then((records) => {
          if (mounted && Array.isArray(records)) {
            setProjects(normalizeProjects(records));
          }
        })
        .catch(() => {});
    };

    loadProjects();
    const interval = window.setInterval(loadProjects, 15000);
    window.addEventListener('focus', loadProjects);
    window.addEventListener('kavyaProjectsChanged', loadProjects);

    return () => {
      mounted = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', loadProjects);
      window.removeEventListener('kavyaProjectsChanged', loadProjects);
    };
  }, []);

  const liveProjects = useMemo(() => projects.length > 0 ? projects : fallbackProjects(), [projects]);

  return (
    <>
      <Hero title="Project Manager Dashboard" copy="Track project progress, milestones, delivery tasks, and team capacity in one workspace." />
      <QuickActions />
      <CardGrid stats={dashboardStats.projectManager} />
      <div className="dashboard-grid">
        <Section title="Active Projects" action="New Project">
          <DataTable columns={projectColumns} rows={liveProjects} emptyMessage="No projects available." />
        </Section>
        <Section title="Delivery Tasks" action="Assign">
          <DataTable columns={taskColumns} rows={fallbackTasks.slice(0, 3)} />
        </Section>
      </div>
      <InsightGrid />
    </>
  );
}

function normalizeProjects(items = []) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    manager: item.manager,
    team: item.team || '',
    milestone: item.milestone || '',
    progress: item.progress || '0%',
    status: item.status || 'Planning',
  }));
}

function fallbackProjects() {
  return people.slice(0, 3).map((person, index) => ({
    id: `PRJ-${index + 1}`,
    name: `${person.department} Project`,
    manager: person.name,
    team: person.role,
    milestone: 'In progress',
    progress: `${50 + (index * 10)}%`,
    status: index === 0 ? 'Active' : 'Planning',
  }));
}

export default ProjectManagerDashboard;
