import { apiRequest } from './api.js';

export function normalizeTaskRows(rows = []) {
  return rows.map((task, index) => ({
    id: task.id || `TSK-${String(index + 101).padStart(3, '0')}`,
    title: task.title || '-',
    description: task.description || '',
    owner: task.owner || task.assignedToName || task.assignedTo || '-',
    assignedToId: task.assignedToId || '',
    assignedToName: task.assignedToName || task.owner || task.assignedTo || '-',
    assignedById: task.assignedById || '',
    assignedByName: task.assignedByName || '',
    assignedBy: task.assignedBy || task.assignedByName || '-',
    assignedByRole: task.assignedByRole || '',
    priority: task.priority || 'Medium',
    due: task.due || task.dueDate || '-',
    dueDate: task.dueDate || task.due || '',
    status: task.status || 'Pending',
    teamLeadId: task.teamLeadId || task.assignedById || '',
    projectId: task.projectId || '',
    projectName: task.projectName || '',
    projectCode: task.projectCode || '',
    createdDateTime: task.createdDateTime || task.createdAt || '',
  }));
}

export function serializeTaskForApi(task) {
  return {
    id: task.id,
    title: task.title,
    description: task.description || '',
    owner: task.owner || task.assignedToName || task.assignedTo || '-',
    assignedToId: task.assignedToId || '',
    assignedToName: task.assignedToName || task.owner || task.assignedTo || '-',
    assignedTo: task.assignedTo || task.assignedToName || task.owner || '-',
    assignedById: task.assignedById || '',
    assignedByName: task.assignedByName || '',
    assignedBy: task.assignedBy || task.assignedByName || '-',
    assignedByRole: task.assignedByRole || '',
    priority: task.priority || 'Medium',
    dueDate: task.due || task.dueDate || '',
    status: task.status || 'Pending',
    teamLeadId: task.teamLeadId || task.assignedById || '',
    projectId: task.projectId || '',
    projectName: task.projectName || '',
    projectCode: task.projectCode || '',
    createdDateTime: task.createdDateTime || task.createdAt || '',
  };
}

export function getNextTaskCode(tasks = []) {
  const highest = tasks.reduce((max, task) => {
    const match = String(task.id || '').match(/^TSK-(\d+)$/i);
    if (!match) {
      return max;
    }

    const value = Number.parseInt(match[1], 10);
    return Number.isFinite(value) && value > max ? value : max;
  }, 100);

  return `TSK-${String(highest + 1)}`;
}

export async function loadTasksWithSeed() {
  const records = await apiRequest('/tasks').catch(() => []);
  return normalizeTaskRows(Array.isArray(records) ? records : []);
}
