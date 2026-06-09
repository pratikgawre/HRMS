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
    projectId: task.projectId || '',
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
    projectId: task.projectId || '',
  };
}

export async function saveTaskToDatabase(task) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify(serializeTaskForApi(task)),
  });
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

export async function loadTasksWithSeed(seedTasks = []) {
  const records = await apiRequest('/tasks').catch(() => []);
  if (Array.isArray(records) && records.length > 0) {
    return normalizeTaskRows(records);
  }

  const normalizedSeed = normalizeTaskRows(seedTasks);
  if (normalizedSeed.length > 0) {
    await apiRequest('/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify(normalizedSeed.map(serializeTaskForApi)),
    }).catch(() => {});
  }

  return normalizedSeed;
}
