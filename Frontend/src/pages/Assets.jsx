import { useMemo, useState } from 'react';
import DataTable from '../components/DataTable.jsx';
import DashboardCard from '../components/DashboardCard.jsx';
import { Hero, Section } from './AdminDashboard.jsx';
import { getSessionValue } from '../utils/appSession.js';

const initialAssets = [
  { id: 'AST-101', assetName: 'Dell Latitude 5440', category: 'Laptop', assignedTo: 'Aarav Sharma', status: 'Assigned', condition: 'Good', location: 'Office' },
  { id: 'AST-102', assetName: 'HP EliteBook 840', category: 'Laptop', assignedTo: 'Meera Nair', status: 'Assigned', condition: 'Good', location: 'Remote' },
  { id: 'AST-103', assetName: 'Logitech MX Keys', category: 'Keyboard', assignedTo: '-', status: 'Available', condition: 'New', location: 'Store' },
  { id: 'AST-104', assetName: 'Samsung Monitor 24"', category: 'Monitor', assignedTo: 'Kabir Khan', status: 'Pending Return', condition: 'Good', location: 'Cabin 3' },
  { id: 'AST-105', assetName: 'Sony Headset WH-1000XM5', category: 'Headset', assignedTo: '-', status: 'Repair Needed', condition: 'Faulty', location: 'Store' },
  { id: 'AST-106', assetName: 'iPhone 13', category: 'Phone', assignedTo: 'Isha Patel', status: 'Replacement Requested', condition: 'Damaged', location: 'IT Desk' },
];

function Assets() {
  const role = getSessionValue('kavyaRole') || 'employee';
  const canManage = role === 'admin' || role === 'hr';
  const [assets, setAssets] = useState(initialAssets);

  const stats = useMemo(() => ([
    {
      label: 'Total Assets',
      value: String(assets.length).padStart(2, '0'),
      delta: 'Tracked items',
      tone: 'blue',
      icon: 'ri-briefcase-4-line',
    },
    {
      label: 'Assigned',
      value: String(assets.filter((asset) => asset.status === 'Assigned').length).padStart(2, '0'),
      delta: 'In use',
      tone: 'green',
      icon: 'ri-user-follow-line',
    },
    {
      label: 'Needs Attention',
      value: String(assets.filter((asset) => ['Replacement Requested', 'Repair Needed'].includes(asset.status)).length).padStart(2, '0'),
      delta: 'Replacement or repair',
      tone: 'orange',
      icon: 'ri-alert-line',
    },
    {
      label: 'Available',
      value: String(assets.filter((asset) => asset.status === 'Available').length).padStart(2, '0'),
      delta: 'Ready to assign',
      tone: 'pink',
      icon: 'ri-checkbox-circle-line',
    },
  ]), [assets]);

  const updateAsset = (assetId, patch) => {
    if (!canManage) {
      return;
    }

    setAssets((current) => current.map((asset) => (asset.id === assetId ? { ...asset, ...patch } : asset)));
  };

  const assetColumns = [
    { key: 'id', label: 'Asset ID' },
    { key: 'assetName', label: 'Asset' },
    { key: 'category', label: 'Category' },
    {
      key: 'assignedTo',
      label: 'Assigned To',
      render: (asset) => <span>{asset.assignedTo}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (asset) => <span className={`status status-${asset.status.toLowerCase().replaceAll(' ', '-')}`}>{asset.status}</span>,
    },
    { key: 'location', label: 'Location' },
    ...(canManage ? [{
      key: 'actions',
      label: 'Actions',
      render: (asset) => (
        <div className="table-actions">
          <button type="button" onClick={() => updateAsset(asset.id, asset.status === 'Assigned' ? { assignedTo: '-', status: 'Available' } : { assignedTo: 'Assigned User', status: 'Assigned' })}>
            {asset.status === 'Assigned' ? 'Release' : 'Assign'}
          </button>
          <button type="button" onClick={() => updateAsset(asset.id, { status: asset.status === 'Repair Needed' ? 'Available' : 'Repair Needed' })}>
            {asset.status === 'Repair Needed' ? 'Mark Ready' : 'Repair'}
          </button>
        </div>
      ),
    }] : []),
  ];

  const requestColumns = [
    { key: 'id', label: 'Asset ID' },
    { key: 'assetName', label: 'Asset' },
    { key: 'assignedTo', label: 'Assigned To' },
    { key: 'status', label: 'Request Status' },
  ];

  const assignedAssets = assets.filter((asset) => asset.status === 'Assigned');
  const replacementRequests = assets.filter((asset) => asset.status === 'Replacement Requested');
  const repairAssets = assets.filter((asset) => asset.status === 'Repair Needed');
  const returnAssets = assets.filter((asset) => asset.status === 'Pending Return');

  return (
    <>
      <Hero
        title="Asset Management"
        copy={role === 'employee'
          ? 'View your assigned assets and raise replacement or repair requests.'
          : 'Manage company assets, assignments, repair status, replacement requests, and return tracking.'}
      />

      <div className="card-grid">
        {stats.map((item) => <DashboardCard key={item.label} {...item} />)}
      </div>

      <Section title="Manage Assets">
        <DataTable columns={assetColumns} rows={assets} emptyMessage="No assets found." />
      </Section>

      <div className="assets-stack">
        <Section title="Asset Assignment">
          <DataTable columns={requestColumns} rows={assignedAssets} emptyMessage="No assigned assets." />
        </Section>
        <Section title="Replacement Request">
          <DataTable columns={requestColumns} rows={replacementRequests} emptyMessage="No replacement requests." />
        </Section>
        <Section title="Repair Status">
          <DataTable columns={requestColumns} rows={repairAssets} emptyMessage="No repair requests." />
        </Section>
        <Section title="Return Asset">
          <DataTable columns={requestColumns} rows={returnAssets} emptyMessage="No returns pending." />
        </Section>
      </div>
    </>
  );
}

export default Assets;
