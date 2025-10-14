'use client';

import React, { useState } from 'react';
import { 
  mockDPRDocuments, 
  mockUsers, 
  getReviewsByDPRId, 
  getCommentsByDPRId,
  mockActivityTimeline 
} from '@/lib/mockCollaborationData';

export default function OfficerDashboard() {
  const [selectedDPR, setSelectedDPR] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'review' | 'comments'>('overview');
  
  // Mock current user - in real app, this would come from auth context
  const currentUser = mockUsers.find(u => u.role === 'compliance'); // Priya Sharma

  // Get DPRs assigned to current user
  const assignedDPRs = mockDPRDocuments.filter(dpr => 
    dpr.assignedOfficers.some(officer => officer.userId === currentUser?.id)
  );

  const selectedDPRData = selectedDPR ? mockDPRDocuments.find(d => d.id === selectedDPR) : null;
  const reviews = selectedDPR ? getReviewsByDPRId(selectedDPR) : [];
  const comments = selectedDPR ? getCommentsByDPRId(selectedDPR) : [];
  const myReview = reviews.find(r => r.reviewer.userId === currentUser?.id);
  const activity = selectedDPR ? mockActivityTimeline[selectedDPR as keyof typeof mockActivityTimeline] || [] : [];

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'pending': 'bg-gray-100 text-gray-700',
      'in_progress': 'bg-blue-100 text-blue-700',
      'completed': 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const stats = {
    total: assignedDPRs.length,
    pending: assignedDPRs.filter(dpr => {
      const assignment = dpr.assignedOfficers.find(a => a.userId === currentUser?.id);
      return assignment?.status === 'pending';
    }).length,
    inProgress: assignedDPRs.filter(dpr => {
      const assignment = dpr.assignedOfficers.find(a => a.userId === currentUser?.id);
      return assignment?.status === 'in_progress';
    }).length,
    completed: assignedDPRs.filter(dpr => {
      const assignment = dpr.assignedOfficers.find(a => a.userId === currentUser?.id);
      return assignment?.status === 'completed';
    }).length
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <img src={currentUser?.avatar} alt={currentUser?.name} className="w-16 h-16 rounded-full" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{currentUser?.name}</h1>
              <p className="text-gray-600">{currentUser?.department}</p>
              <span className="text-xs px-3 py-1 rounded-full bg-blue-100 text-blue-700 inline-block mt-1">
                {currentUser?.role.toUpperCase()} OFFICER
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Assigned to Me</p>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-3xl font-bold text-gray-600">{stats.pending}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-3xl font-bold text-blue-600">{stats.inProgress}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DPR List */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className="text-xl font-bold text-gray-900">My Assignments</h2>
            {assignedDPRs.map(dpr => {
              const myAssignment = dpr.assignedOfficers.find(a => a.userId === currentUser?.id);
              return (
                <div
                  key={dpr.id}
                  onClick={() => setSelectedDPR(dpr.id)}
                  className={`bg-white p-4 rounded-lg shadow cursor-pointer transition-all ${
                    selectedDPR === dpr.id ? 'ring-2 ring-blue-500' : 'hover:shadow-lg'
                  }`}
                >
                  <h3 className="font-semibold text-gray-900 mb-1">{dpr.projectTitle}</h3>
                  <p className="text-sm text-gray-600 mb-2">{dpr.location}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(myAssignment?.status || 'pending')}`}>
                      {myAssignment?.status || 'pending'}
                    </span>
                    <span className="text-xs text-gray-500">{dpr.commentCount} comments</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Details Panel */}
          <div className="lg:col-span-2">
            {selectedDPRData ? (
              <div className="bg-white rounded-lg shadow">
                {/* Tabs */}
                <div className="border-b">
                  <div className="flex">
                    {(['overview', 'review', 'comments'] as const).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-3 font-medium ${
                          activeTab === tab
                            ? 'border-b-2 border-blue-600 text-blue-600'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-6">
                  {/* Overview Tab */}
                  {activeTab === 'overview' && (
                    <div className="space-y-6">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedDPRData.projectTitle}</h2>
                        <p className="text-gray-600">{selectedDPRData.filename}</p>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-gray-600">Location</p>
                          <p className="font-medium">{selectedDPRData.location}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Budget</p>
                          <p className="font-medium">₹{(selectedDPRData.budgetAmount / 10000000).toFixed(2)} Cr</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Duration</p>
                          <p className="font-medium">{selectedDPRData.duration}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Overall Score</p>
                          <p className="font-medium text-blue-600">{selectedDPRData.analysisData.overall_score}/100</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-900 mb-2">AI Analysis Summary</h3>
                        <p className="text-gray-700">{selectedDPRData.analysisData.summary}</p>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Assigned Officers</h3>
                        <div className="space-y-2">
                          {selectedDPRData.assignedOfficers.map(officer => (
                            <div key={officer.userId} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                              <img 
                                src={mockUsers.find(u => u.id === officer.userId)?.avatar} 
                                alt={officer.name}
                                className="w-10 h-10 rounded-full"
                              />
                              <div className="flex-1">
                                <p className="font-medium">{officer.name}</p>
                                <p className="text-sm text-gray-600">{officer.role}</p>
                              </div>
                              <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(officer.status)}`}>
                                {officer.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-semibold text-gray-900 mb-3">Activity Timeline</h3>
                        <div className="space-y-3">
                          {activity.slice(0, 5).map(item => (
                            <div key={item.id} className="flex gap-3">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-900">{item.description}</p>
                                <p className="text-xs text-gray-500">
                                  {item.actor.name} • {new Date(item.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Review Tab */}
                  {activeTab === 'review' && (
                    <div className="space-y-6">
                      {myReview ? (
                        <>
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-gray-900">My Review</h3>
                            <span className={`px-3 py-1 rounded-full text-sm ${getStatusColor(myReview.status)}`}>
                              {myReview.status}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-sm text-gray-600">Score</p>
                              <p className="text-3xl font-bold text-blue-600">{myReview.score}/100</p>
                            </div>
                            <div>
                              <p className="text-sm text-gray-600">Recommendation</p>
                              <p className="font-medium">{myReview.recommendation?.replace(/_/g, ' ')}</p>
                            </div>
                          </div>

                          {myReview.findings && myReview.findings.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3">Findings ({myReview.findings.length})</h4>
                              <div className="space-y-3">
                                {myReview.findings.map(finding => (
                                  <div key={finding.id} className="border-l-4 border-yellow-500 pl-4 py-2">
                                    <div className="flex items-start justify-between mb-1">
                                      <p className="font-medium text-gray-900">{finding.issue}</p>
                                      <span className={`text-xs px-2 py-1 rounded ${
                                        finding.severity === 'high' ? 'bg-red-100 text-red-700' :
                                        finding.severity === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-blue-100 text-blue-700'
                                      }`}>
                                        {finding.severity}
                                      </span>
                                    </div>
                                    <p className="text-sm text-gray-600 mb-2">{finding.recommendation}</p>
                                    <span className="text-xs text-gray-500">{finding.category}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {myReview.strengths && myReview.strengths.length > 0 && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-3">Strengths</h4>
                              <div className="space-y-2">
                                {myReview.strengths.map((strength, idx) => (
                                  <div key={idx} className="flex gap-2 text-sm">
                                    <span className="text-green-600">✓</span>
                                    <p className="text-gray-700">{strength.point}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {myReview.generalComments && (
                            <div>
                              <h4 className="font-semibold text-gray-900 mb-2">General Comments</h4>
                              <p className="text-gray-700">{myReview.generalComments}</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-center py-12">
                          <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <p className="text-gray-600 mb-4">You haven't started your review yet</p>
                          <button className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Start Review
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Comments Tab */}
                  {activeTab === 'comments' && (
                    <div className="space-y-4">
                      <h3 className="text-xl font-bold text-gray-900">Collaboration ({comments.length})</h3>
                      
                      {/* Comment Input */}
                      <div className="border rounded-lg p-4">
                        <textarea
                          placeholder="Add a comment... Use @name to mention officers"
                          className="w-full p-2 border rounded-lg mb-2"
                          rows={3}
                        />
                        <div className="flex justify-end gap-2">
                          <button className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
                          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                            Post Comment
                          </button>
                        </div>
                      </div>

                      {/* Comments List */}
                      <div className="space-y-4">
                        {comments.map(comment => (
                          <div key={comment.id} className={`border rounded-lg p-4 ${comment.isResolved ? 'bg-green-50' : ''}`}>
                            <div className="flex items-start gap-3">
                              <img 
                                src={mockUsers.find(u => u.id === comment.author.userId)?.avatar}
                                alt={comment.author.name}
                                className="w-10 h-10 rounded-full"
                              />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-semibold">{comment.author.name}</p>
                                  <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">
                                    {comment.author.role}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {new Date(comment.createdAt).toLocaleString()}
                                  </span>
                                  {comment.isResolved && (
                                    <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                                      ✓ Resolved
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-700">{comment.comment}</p>
                                
                                {comment.type && (
                                  <span className={`text-xs px-2 py-1 rounded inline-block mt-2 ${
                                    comment.type === 'question' ? 'bg-blue-100 text-blue-700' :
                                    comment.type === 'concern' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>
                                    {comment.type}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-12 text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600">Select a DPR from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
