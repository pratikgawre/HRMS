import { apiRequest } from './api.js';

export function normalizeTaskRows(rows = []) {
  return rows.map((task, index) => ({
    ...task,
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
    taskSummary: task.taskSummary || '',
    attachmentUrl: task.attachmentUrl || '',
    attachmentName: task.attachmentName || '',
    attachmentType: task.attachmentType || '',
    attachments: normalizeAttachments(task),
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
    taskSummary: task.taskSummary || '',
    attachmentUrl: task.attachmentUrl || '',
    attachmentName: task.attachmentName || '',
    attachmentType: task.attachmentType || '',
    attachments: normalizeAttachments(task),
  };
}

function normalizeAttachments(task) {
  const attachments = Array.isArray(task?.attachments)
    ? task.attachments.map((attachment) => ({
        id: attachment?.id || attachment?.attachmentId || '',
        url: attachment?.url || attachment?.attachmentUrl || '',
        name: attachment?.name || attachment?.attachmentName || 'Task attachment',
        type: attachment?.type || attachment?.attachmentType || '',
        size: Number(attachment?.size || 0),
      })).filter((attachment) => attachment.url)
    : [];

  if (attachments.length > 0) {
    return attachments;
  }

  return task?.attachmentUrl ? [{
    id: task.attachmentId || '',
    url: task.attachmentUrl,
    name: task.attachmentName || 'Task attachment',
    type: task.attachmentType || '',
    size: 0,
  }] : [];
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
