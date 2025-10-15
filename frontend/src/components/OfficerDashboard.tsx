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
  const [documents] = useState(mockDPRDocuments.filter(doc => doc.status === 'under_review' || doc.status === 'submitted'));

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Officer Dashboard</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Documents for Review */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Documents for Review</h2>
            <div className="space-y-4">
              {documents.map((doc) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-medium text-gray-900">{doc.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Created: {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      doc.status === 'under_review' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {doc.status}
                    </span>
                  </div>
                  <button
                    onClick={() => setSelectedDPR(selectedDPR === doc.id ? null : doc.id)}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    {selectedDPR === doc.id ? 'Hide Details' : 'View Details'}
                  </button>
                  
                  {selectedDPR === doc.id && (
                    <div className="mt-4 p-4 bg-gray-50 rounded">
                      <p className="text-sm text-gray-700">{doc.content}</p>
                      <div className="mt-4">
                        <h4 className="font-medium text-gray-900">Reviews:</h4>
                        {getReviewsByDPRId(doc.id).map((review) => (
                          <div key={review.id} className="mt-2 text-sm text-gray-600">
                            Rating: {review.rating}/5 - {review.comment}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent Activity</h2>
            <div className="space-y-4">
              {mockActivityTimeline.slice(0, 5).map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                    {activity.details && (
                      <p className="text-xs text-gray-600 mt-1">{activity.details}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}