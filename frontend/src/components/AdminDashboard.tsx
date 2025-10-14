'use client';

import React, { useState } from 'react';
import { mockDPRDocuments, mockUsers } from '@/lib/mockCollaborationData';

interface AssignmentModalProps {
  dprId: string;
  isOpen: boolean;
  onClose: () => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({ dprId, isOpen, onClose }) => {
  const [selectedOfficers, setSelectedOfficers] = useState<string[]>([]);
  const officers = mockUsers.filter(u => ['compliance', 'technical', 'financial'].includes(u.role));
  
  const toggleOfficer = (officerId: string) => {
    setSelectedOfficers(prev => 
      prev.includes(officerId) 
        ? prev.filter(id => id !== officerId)
        : [...prev, officerId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">Assign Officers to Review</h2>
        
        <div className="space-y-4">
          {officers.map(officer => (
            <div key={officer.id} className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedOfficers.includes(officer.id)}
                onChange={() => toggleOfficer(officer.id)}
                className="w-5 h-5"
              />
              <img src={officer.avatar} alt={officer.name} className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                <h3 className="font-semibold">{officer.name}</h3>
                <p className="text-sm text-gray-600">{officer.department}</p>
                <span className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 inline-block mt-1">
                  {officer.role.toUpperCase()}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              alert(`Assigned ${selectedOfficers.length} officers to DPR ${dprId}`);
              onClose();
            }}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Assign Officers ({selectedOfficers.length})
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const [selectedDPR, setSelectedDPR] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filteredDPRs = filter === 'all' 
    ? mockDPRDocuments 
    : mockDPRDocuments.filter(dpr => dpr.status === filter);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-700',
      'assigned': 'bg-blue-100 text-blue-700',
      'under_review': 'bg-yellow-100 text-yellow-700',
      'completed': 'bg-green-100 text-green-700',
      'approved': 'bg-green-100 text-green-700',
      'rejected': 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'high': 'text-red-600',
      'medium': 'text-orange-600',
      'low': 'text-green-600'
    };
    return colors[priority] || 'text-gray-600';
  };

  const stats = {
    total: mockDPRDocuments.length,
    pending: mockDPRDocuments.filter(d => d.status === 'pending').length,
    underReview: mockDPRDocuments.filter(d => d.status === 'under_review').length,
    completed: mockDPRDocuments.filter(d => d.status === 'completed').length
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage DPR assignments and track review progress</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total DPRs</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-3xl font-bold text-gray-900">{stats.pending}</p>
              </div>
              <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Under Review</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.underReview}</p>
              </div>
              <svg className="w-12 h-12 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <div className="flex gap-2">
            {['all', 'pending', 'assigned', 'under_review', 'completed'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium ${
                  filter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* DPR List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left p-4 font-semibold text-gray-900">Project</th>
                  <th className="text-left p-4 font-semibold text-gray-900">Location</th>
                  <th className="text-left p-4 font-semibold text-gray-900">Budget</th>
                  <th className="text-left p-4 font-semibold text-gray-900">Status</th>
                  <th className="text-left p-4 font-semibold text-gray-900">Assigned Officers</th>
                  <th className="text-left p-4 font-semibold text-gray-900">Priority</th>
                  <th className="text-left p-4 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredDPRs.map(dpr => (
                  <tr key={dpr.id} className="border-b hover:bg-gray-50">
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-gray-900">{dpr.projectTitle}</p>
                        <p className="text-sm text-gray-500">{dpr.filename}</p>
                      </div>
                    </td>
                    <td className="p-4 text-gray-700">{dpr.location}</td>
                    <td className="p-4 text-gray-700">₹{(dpr.budgetAmount / 10000000).toFixed(2)} Cr</td>
                    <td className="p-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(dpr.status)}`}>
                        {dpr.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4">
                      {dpr.assignedOfficers.length > 0 ? (
                        <div className="flex -space-x-2">
                          {dpr.assignedOfficers.slice(0, 3).map(officer => (
                            <div key={officer.userId} className="relative group">
                              <img
                                src={mockUsers.find(u => u.id === officer.userId)?.avatar}
                                alt={officer.name}
                                className="w-8 h-8 rounded-full border-2 border-white"
                                title={officer.name}
                              />
                            </div>
                          ))}
                          {dpr.assignedOfficers.length > 3 && (
                            <div className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs">
                              +{dpr.assignedOfficers.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">Not assigned</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={`font-semibold ${getPriorityColor(dpr.priority)}`}>
                        {dpr.priority.toUpperCase()}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => setSelectedDPR(dpr.id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                      >
                        Assign Officers
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Assignment Modal */}
      {selectedDPR && (
        <AssignmentModal
          dprId={selectedDPR}
          isOpen={!!selectedDPR}
          onClose={() => setSelectedDPR(null)}
        />
      )}
    </div>
  );
}
