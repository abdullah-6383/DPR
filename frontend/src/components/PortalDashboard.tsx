'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, User } from '@/lib/auth';
import Navigation from '@/components/Navigation';
import { useDocuments, UploadedDocument } from '@/contexts/DocumentContext';

const PortalContent: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check if user is authenticated
    if (!auth.isAuthenticated()) {
      router.push('/login');
      return;
    }

    const userData = auth.getUser();
    setUser(userData);
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    auth.logout();
    router.push('/');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-black py-20 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Role-specific Content */}
        {user.role === 'mdoner' ? (
          <MDoNERDashboard />
        ) : (
          <ClientDashboard />
        )}
      </div>
    </div>
  );
};

const MDoNERDashboard: React.FC = () => {
  const { getAllDocuments, updateDocumentStatus, getSubmittedDocuments } = useDocuments();
  const [selectedFilter, setSelectedFilter] = useState<'all' | UploadedDocument['status']>('all');
  const [submittedDocuments, setSubmittedDocuments] = useState<UploadedDocument[]>([]);
  
  // Load submitted documents when component mounts and refresh periodically
  useEffect(() => {
    const loadSubmittedDocuments = async () => {
      try {
        const submitted = await getSubmittedDocuments();
        setSubmittedDocuments(submitted);
      } catch (error) {
        console.error('Error loading submitted documents:', error);
      }
    };

    loadSubmittedDocuments();
    
    // Refresh every 10 seconds to catch new submissions
    const interval = setInterval(loadSubmittedDocuments, 10000);
    return () => clearInterval(interval);
  }, [getSubmittedDocuments]);
  
  // Combine all documents with submitted documents (avoid duplicates)
  const allDocuments = getAllDocuments();
  const combinedDocuments = [...allDocuments];
  
  // Add submitted documents that aren't already in allDocuments
  submittedDocuments.forEach(submittedDoc => {
    if (!allDocuments.find(doc => doc.id === submittedDoc.id)) {
      combinedDocuments.push(submittedDoc);
    }
  });
  const filteredDocuments = selectedFilter === 'all' 
    ? combinedDocuments 
    : combinedDocuments.filter(doc => doc.status === selectedFilter);

  const statusCounts = {
    pending: combinedDocuments.filter(doc => doc.status === 'pending').length,
    'under-review': combinedDocuments.filter(doc => doc.status === 'under-review').length,
    approved: combinedDocuments.filter(doc => doc.status === 'approved').length,
    rejected: combinedDocuments.filter(doc => doc.status === 'rejected').length,
    viewed: combinedDocuments.filter(doc => doc.status === 'viewed').length,
    submitted: combinedDocuments.filter(doc => doc.status === 'submitted').length,
  };

  const handleStatusUpdate = async (docId: string, newStatus: UploadedDocument['status']) => {
    const comments = {
      'viewed': 'Document has been reviewed by admin.',
      'under-review': 'Document is currently under detailed review.',
      'approved': 'Document meets all requirements and has been approved.',
      'rejected': 'Document requires revisions. Please resubmit with corrections.'
    };
    
    await updateDocumentStatus(
      docId, 
      newStatus, 
      comments[newStatus as keyof typeof comments],
      { name: 'MDoNER Admin', email: 'mdoner.admin@gov.in' }
    );
    
    // Refresh submitted documents after status update
    try {
      const submitted = await getSubmittedDocuments();
      setSubmittedDocuments(submitted);
    } catch (error) {
      console.error('Error refreshing submitted documents:', error);
    }
  };

  const handleViewAdminReport = (document: UploadedDocument) => {
    if (document.analysisData) {
      // Create admin-specific report with approval information
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        const structuredAnalysis = document.analysisData.structured_analysis || {};
        const execSummary = structuredAnalysis.executive_summary || {};
        const approvalRec = document.analysisData.analysis?.approval_recommendation || document.analysisData.approval_recommendation;
        
        reportWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>[ADMIN] DPR Analysis Report - ${document.name}</title>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
                max-width: 1000px;
                margin: 0 auto;
                padding: 40px 20px;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                color: #2d3748;
                line-height: 1.8;
              }
              
              .admin-header {
                background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
                color: white;
                padding: 40px;
                border-radius: 15px;
                margin-bottom: 40px;
                box-shadow: 0 10px 40px rgba(229, 62, 62, 0.3);
              }
              
              .admin-header h1 {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 20px;
                letter-spacing: -0.5px;
              }
              
              .admin-badge {
                display: inline-block;
                background: rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 15px;
              }
              
              .header-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 25px;
                padding-top: 25px;
                border-top: 1px solid rgba(255,255,255,0.2);
              }
              
              .approval-box {
                background: white;
                padding: 35px;
                margin-bottom: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                border-left: 5px solid #e53e3e;
              }
              
              .approval-box h2 {
                color: #e53e3e;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 25px;
                display: flex;
                align-items: center;
                gap: 10px;
              }
              
              .approval-decision {
                display: inline-block;
                padding: 12px 24px;
                border-radius: 25px;
                font-size: 16px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 20px;
              }
              
              .decision-approve { background: #c6f6d5; color: #22543d; }
              .decision-revise { background: #fed7d7; color: #742a2a; }
              .decision-reject { background: #feb2b2; color: #742a2a; }
              .decision-approve_with_conditions { background: #fef5e7; color: #744210; }
              
              .section {
                background: white;
                padding: 35px;
                margin-bottom: 25px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              }
              
              .section h2 {
                color: #2d3748;
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 3px solid #667eea;
              }
              
              .metadata {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-top: 30px;
                font-size: 14px;
                color: #718096;
              }
              
              .print-button {
                position: fixed;
                bottom: 30px;
                right: 30px;
                padding: 15px 30px;
                background: #e53e3e;
                color: white;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                box-shadow: 0 10px 30px rgba(229, 62, 62, 0.4);
                transition: all 0.3s ease;
              }
              
              .print-button:hover {
                background: #c53030;
                transform: translateY(-2px);
                box-shadow: 0 15px 40px rgba(229, 62, 62, 0.5);
              }
              
              @media print {
                body { 
                  background: white; 
                  padding: 20px;
                }
                .section, .approval-box { 
                  box-shadow: none; 
                  border: 1px solid #e2e8f0; 
                  page-break-inside: avoid;
                }
                .print-button {
                  display: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="admin-header">
              <div class="admin-badge">🔒 Admin Access Only</div>
              <h1>[ADMIN] DPR Analysis Report</h1>
              <div class="header-info">
                <div>
                  <strong>Document:</strong> ${document.name}<br>
                  <strong>Status:</strong> ${document.status.toUpperCase()}<br>
                  <strong>Uploaded:</strong> ${new Date(document.uploadDate).toLocaleDateString()}
                </div>
              </div>
            </div>
            
            ${approvalRec ? `
            <div class="approval-box">
              <h2>🎯 Approval Recommendation</h2>
              <div class="approval-decision decision-${(approvalRec.decision || '').toLowerCase().replace(/_/g, '_')}">
                ${approvalRec.decision || 'PENDING'}
              </div>
              
              ${approvalRec.reasoning ? `
              <div style="margin-top: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 10px;">Reasoning:</h3>
                <p style="line-height: 1.7; color: #4a5568;">${approvalRec.reasoning}</p>
              </div>
              ` : ''}
            </div>
            ` : ''}
            
            ${structuredAnalysis.executive_summary ? `
            <div class="section">
              <h2>Executive Summary</h2>
              <div style="line-height: 1.8; color: #4a5568;">
                ${structuredAnalysis.executive_summary.summary || 'No summary available'}
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.budget_analysis ? `
            <div class="section">
              <h2>Budget Analysis</h2>
              <div style="line-height: 1.8; color: #4a5568; white-space: pre-wrap;">
                ${structuredAnalysis.budget_analysis}
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.timeline_evaluation ? `
            <div class="section">
              <h2>Timeline Evaluation</h2>
              <div style="line-height: 1.8; color: #4a5568; white-space: pre-wrap;">
                ${structuredAnalysis.timeline_evaluation}
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.technical_feasibility ? `
            <div class="section">
              <h2>Technical Feasibility</h2>
              <div style="line-height: 1.8; color: #4a5568; white-space: pre-wrap;">
                ${structuredAnalysis.technical_feasibility}
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.risk_assessment ? `
            <div class="section">
              <h2>Risk Assessment</h2>
              <div style="line-height: 1.8; color: #4a5568; white-space: pre-wrap;">
                ${structuredAnalysis.risk_assessment}
              </div>
            </div>
            ` : ''}
            
            <div class="metadata">
              <strong>[ADMIN METADATA]</strong><br>
              Generated: ${new Date().toLocaleString()}<br>
              Document ID: ${document.id}<br>
              Admin Access: Full analysis with approval recommendations
            </div>
            
            <button onclick="window.print()" class="print-button">
              [ADMIN] Print Report
            </button>
          </body>
          </html>
        `);
        reportWindow.document.close();
      }
    }
  };

  const getStatusBadge = (status: UploadedDocument['status']) => {
    const statusConfig = {
      'pending': { 
        bg: 'bg-yellow-900/50', 
        text: 'text-yellow-300', 
        border: 'border-yellow-500/30',
        icon: '⌛',
        label: 'Pending'
      },
      'viewed': { 
        bg: 'bg-blue-900/50', 
        text: 'text-blue-300', 
        border: 'border-blue-500/30',
        icon: '👁',
        label: 'Viewed'
      },
      'under-review': { 
        bg: 'bg-purple-900/50', 
        text: 'text-purple-300', 
        border: 'border-purple-500/30',
        icon: '🔎',
        label: 'Under Review'
      },
      'approved': { 
        bg: 'bg-green-900/50', 
        text: 'text-green-300', 
        border: 'border-green-500/30',
        icon: '✓',
        label: 'Approved'
      },
      'rejected': { 
        bg: 'bg-red-900/50', 
        text: 'text-red-300', 
        border: 'border-red-500/30',
        icon: '✗',
        label: 'Rejected'
      },
      'submitted': { 
        bg: 'bg-amber-900/50', 
        text: 'text-amber-300', 
        border: 'border-amber-500/30',
        icon: '📤',
        label: 'Submitted'
      }
    };

    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text} border ${config.border}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="w-full min-h-screen">
      <Navigation />
      
      <div className="pt-32 px-6">
        {/* Debug Info - Shows total documents loaded */}
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-3 mb-6">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-blue-300 font-medium">System Status:</span>
              <span className="text-white">{allDocuments.length} total documents loaded</span>
              {filteredDocuments.length !== allDocuments.length && (
                <span className="text-gray-400">• {filteredDocuments.length} showing (filtered by: {selectedFilter})</span>
              )}
            </div>
            {allDocuments.length === 0 && (
              <span className="text-amber-400 text-xs">⚠️ No documents in system. Upload documents from client portal to see them here.</span>
            )}
          </div>
        </div>

        {/* Admin Statistics */}
      <div className="grid md:grid-cols-5 gap-6 mb-8">
        <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-yellow-600/20 rounded-lg flex items-center justify-center mr-4">
              <span className="text-2xl">⌛</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">Pending</h3>
              <p className="text-gray-400 text-sm">New submissions</p>
            </div>
          </div>
          <div className="text-yellow-300 text-2xl font-bold">{statusCounts.pending}</div>
        </div>

        <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mr-4">
              <span className="text-2xl">🔎</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">Reviewing</h3>
              <p className="text-gray-400 text-sm">Under assessment</p>
            </div>
          </div>
          <div className="text-purple-300 text-2xl font-bold">{statusCounts['under-review']}</div>
        </div>

        <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-green-600/20 rounded-lg flex items-center justify-center mr-4">
              <span className="text-2xl">✓</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">Approved</h3>
              <p className="text-gray-400 text-sm">Ready for implementation</p>
            </div>
          </div>
          <div className="text-green-300 text-2xl font-bold">{statusCounts.approved}</div>
        </div>

        <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center mr-4">
              <span className="text-2xl">✗</span>
            </div>
            <div>
              <h3 className="text-white font-semibold">Rejected</h3>
              <p className="text-gray-400 text-sm">Need revisions</p>
            </div>
          </div>
          <div className="text-red-300 text-2xl font-bold">{statusCounts.rejected}</div>
        </div>

        <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mr-4">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-semibold">Total</h3>
              <p className="text-gray-400 text-sm">All documents</p>
            </div>
          </div>
          <div className="text-blue-300 text-2xl font-bold">{allDocuments.length}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-6 mb-8">
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setSelectedFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedFilter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-gray-300 hover:bg-white/20'
            }`}
          >
            All Documents ({allDocuments.length})
          </button>
          {Object.entries(statusCounts).map(([status, count]) => (
            <button
              key={status}
              onClick={() => setSelectedFilter(status as UploadedDocument['status'])}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedFilter === status
                  ? 'bg-blue-600 text-white'
                  : status === 'submitted'
                  ? count > 0 
                    ? 'bg-amber-600/80 text-white border-2 border-amber-400 animate-pulse'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {status === 'submitted' && count > 0 && '🔥 '}
              {status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')} ({count})
              {status === 'submitted' && count > 0 && ' - Needs Review!'}
            </button>
          ))}
        </div>

        {/* Priority Alert for Submitted Documents */}
        {statusCounts.submitted > 0 && selectedFilter !== 'submitted' && (
          <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 border border-amber-500/50 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-amber-200 font-semibold">Documents Awaiting Review</h3>
                  <p className="text-amber-300/80 text-sm">
                    {statusCounts.submitted} document{statusCounts.submitted !== 1 ? 's' : ''} submitted by clients waiting for your approval decision
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFilter('submitted')}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Review Now
              </button>
            </div>
          </div>
        )}

        {/* Documents List */}
        <div className="space-y-4">
          {filteredDocuments.length === 0 ? (
            <div className="bg-white/5 border border-white/10 rounded-xl p-12 text-center">
              <div className="w-16 h-16 bg-gray-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold mb-2">No Documents Found</h3>
              <p className="text-gray-400 text-sm">
                {selectedFilter === 'all' 
                  ? 'No documents have been uploaded yet. Documents will appear here once clients submit their DPRs.'
                  : `No documents with status "${selectedFilter}". Try selecting a different filter.`
                }
              </p>
              {selectedFilter === 'submitted' && (
                <p className="text-amber-400 text-sm mt-2">
                  💡 Clients need to click "Submit to Admin" on their documents for them to appear here.
                </p>
              )}
            </div>
          ) : (
            filteredDocuments.map((document) => (
            <div key={document.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors duration-200">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold text-sm">{document.name}</h4>
                    <p className="text-gray-400 text-xs">
                      {formatFileSize(document.size)} • {formatDate(document.uploadDate)}
                    </p>
                    <p className="text-gray-500 text-xs">
                      By: {document.uploadedBy.name} ({document.uploadedBy.email})
                    </p>
                  </div>
                </div>
                {getStatusBadge(document.status)}
              </div>

              {document.reviewerComments && (
                <div className="bg-black/20 border border-white/10 rounded-lg p-3 mb-4">
                  <p className="text-xs text-gray-400 mb-1">Comments:</p>
                  <p className="text-gray-300 text-sm">{document.reviewerComments}</p>
                </div>
              )}

              {/* Admin Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleStatusUpdate(document.id, 'viewed')}
                    className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium rounded transition-colors"
                  >
                    Mark Viewed
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(document.id, 'under-review')}
                    className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-medium rounded transition-colors"
                  >
                    Start Review
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(document.id, 'approved')}
                    className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs font-medium rounded transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(document.id, 'rejected')}
                    className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-medium rounded transition-colors"
                  >
                    Reject
                  </button>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleViewAdminReport(document)}
                    disabled={!document.analysisData}
                    className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                      document.analysisData 
                        ? 'text-red-300 hover:text-red-400 cursor-pointer' 
                        : 'text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Admin View
                  </button>
                </div>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
      </div>
    </div>
  );
};

const ClientDashboard: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const { addDocument, getClientDocuments, updateDocumentStatus } = useDocuments();
  
  // Get current user's documents
  const user = auth.getUser();
  const uploadedDocuments = user ? getClientDocuments(user.email) : [];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadStatus('idle');
      setErrorMessage('');
      setAnalysisResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;
    
    setUploadStatus('uploading');
    setErrorMessage('');
    
    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('language', 'en'); // Default to English
      
      // Upload to backend API
      const response = await fetch('http://localhost:8000/api/upload-dpr', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      setUploadStatus('processing');
      const data = await response.json();
      
      if (data.status === 'success') {
        setAnalysisResult(data.result);
        
        // Add the new document using context
        await addDocument({
          name: selectedFile.name,
          size: selectedFile.size,
          uploadDate: new Date().toISOString().split('T')[0],
          status: 'viewed',
          reviewerComments: 'AI analysis completed successfully. Click "View Report" to see detailed analysis.',
          uploadedBy: {
            name: user.name,
            email: user.email,
            department: user.department
          },
          analysisData: data.result // Store the analysis result
        });
        
        setUploadStatus('success');
        
        // Reset after 3 seconds
        setTimeout(() => {
          setUploadStatus('idle');
          setSelectedFile(null);
        }, 3000);
      } else {
        throw new Error('Analysis failed');
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      setUploadStatus('error');
      setErrorMessage(error.message || 'Failed to upload and analyze document');
      
      // Reset error after 5 seconds
      setTimeout(() => {
        setUploadStatus('idle');
        setErrorMessage('');
      }, 5000);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadStatus('idle');
    setErrorMessage('');
    setAnalysisResult(null);
  };

  const handleViewReport = (document: UploadedDocument) => {
    if (document.analysisData) {
      // Create a modal or new window to display the report
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        const structuredAnalysis = document.analysisData.structured_analysis || {};
        const execSummary = structuredAnalysis.executive_summary || {};
        
        reportWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>DPR Analysis Report - ${document.name}</title>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
                max-width: 1000px;
                margin: 0 auto;
                padding: 40px 20px;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                color: #2d3748;
                line-height: 1.8;
              }
              
              .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 40px;
                border-radius: 15px;
                margin-bottom: 40px;
                box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);
              }
              
              .header h1 {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 20px;
                letter-spacing: -0.5px;
              }
              
              .header-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 25px;
                padding-top: 25px;
                border-top: 1px solid rgba(255,255,255,0.2);
              }
              
              .header-info-item {
                display: flex;
                flex-direction: column;
              }
              
              .header-info-label {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                opacity: 0.8;
                margin-bottom: 5px;
              }
              
              .header-info-value {
                font-size: 16px;
                font-weight: 600;
              }
              
              .exec-summary-box {
                background: white;
                padding: 35px;
                margin-bottom: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                border-left: 5px solid #667eea;
              }
              
              .exec-summary-box h2 {
                color: #667eea;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 25px;
              }
              
              .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 25px;
              }
              
              .summary-card {
                background: #f7fafc;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                border: 2px solid #e2e8f0;
              }
              
              .summary-card-label {
                font-size: 12px;
                color: #718096;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
              }
              
              .summary-card-value {
                font-size: 24px;
                font-weight: 700;
                color: #2d3748;
              }
              
              .summary-card-value.approve {
                color: #48bb78;
              }
              
              .summary-card-value.revise {
                color: #ed8936;
              }
              
              .summary-card-value.reject {
                color: #f56565;
              }
              
              .summary-text {
                font-size: 16px;
                line-height: 1.8;
                color: #4a5568;
                padding: 20px;
                background: #edf2f7;
                border-radius: 8px;
              }
              
              .recommendations-box {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                padding: 35px;
                margin-bottom: 30px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
                color: white;
              }
              
              .recommendations-box h2 {
                color: white;
                font-size: 28px;
                font-weight: 700;
                margin-bottom: 15px;
                display: flex;
                align-items: center;
                gap: 10px;
              }
              
              .recommendations-subtitle {
                font-size: 14px;
                opacity: 0.9;
                margin-bottom: 25px;
                font-weight: 500;
              }
              
              .recommendation-item {
                background: rgba(255, 255, 255, 0.15);
                backdrop-filter: blur(10px);
                padding: 20px 25px;
                margin-bottom: 15px;
                border-radius: 10px;
                border-left: 4px solid rgba(255, 255, 255, 0.5);
                transition: all 0.3s ease;
              }
              
              .recommendation-item:hover {
                background: rgba(255, 255, 255, 0.25);
                border-left-color: white;
                transform: translateX(5px);
              }
              
              .recommendation-priority {
                display: inline-block;
                padding: 4px 12px;
                background: rgba(255, 255, 255, 0.3);
                border-radius: 20px;
                font-size: 11px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 10px;
              }
              
              .recommendation-priority.high {
                background: #fc8181;
                color: white;
              }
              
              .recommendation-priority.medium {
                background: #f6ad55;
                color: white;
              }
              
              .recommendation-priority.low {
                background: #68d391;
                color: white;
              }
              
              .recommendation-text {
                line-height: 1.7;
                font-size: 15px;
                color: white;
              }
              
              .recommendation-category {
                display: inline-block;
                margin-top: 10px;
                padding: 3px 10px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 15px;
                font-size: 12px;
                font-weight: 600;
              }
              
              .section {
                background: white;
                padding: 35px;
                margin-bottom: 25px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              }
              
              .section h2 {
                color: #2d3748;
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 3px solid #667eea;
              }
              
              .section-content {
                font-size: 15px;
                line-height: 1.9;
                color: #4a5568;
                white-space: pre-wrap;
                word-wrap: break-word;
              }
              
              .status-badge {
                display: inline-block;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }
              
              .status-valid {
                background: #c6f6d5;
                color: #22543d;
              }
              
              .status-attention {
                background: #fed7d7;
                color: #742a2a;
              }
              
              .status-realistic {
                background: #bee3f8;
                color: #2c5282;
              }
              
              .metadata {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-top: 30px;
                font-size: 14px;
                color: #718096;
              }
              
              .print-button {
                position: fixed;
                bottom: 30px;
                right: 30px;
                padding: 15px 30px;
                background: #667eea;
                color: white;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);
                transition: all 0.3s ease;
              }
              
              .print-button:hover {
                background: #5a67d8;
                transform: translateY(-2px);
                box-shadow: 0 15px 40px rgba(102, 126, 234, 0.5);
              }
              
              @media print {
                body { 
                  background: white; 
                  padding: 20px;
                }
                .section, .exec-summary-box { 
                  box-shadow: none; 
                  border: 1px solid #e2e8f0; 
                  page-break-inside: avoid;
                }
                .print-button {
                  display: none;
                }
              }
              
              @media (max-width: 768px) {
                .summary-grid {
                  grid-template-columns: 1fr;
                }
                .header-info {
                  grid-template-columns: 1fr;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>[REPORT] DPR Analysis Report</h1>
              <div class="header-info">
                <div class="header-info-item">
                  <span class="header-info-label">Document Name</span>
                  <span class="header-info-value">${document.name}</span>
                </div>
                <div class="header-info-item">
                  <span class="header-info-label">Upload Date</span>
                  <span class="header-info-value">${new Date(document.uploadDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="header-info-item">
                  <span class="header-info-label">Status</span>
                  <span class="header-info-value">${document.status.toUpperCase()}</span>
                </div>
              </div>
            </div>
            
            <div class="exec-summary-box">
              <h2>Document Analysis Summary</h2>
              <div class="summary-grid">
                <div class="summary-card">
                  <div class="summary-card-label">Overall Score</div>
                  <div class="summary-card-value">${execSummary.overall_score || 'N/A'}</div>
                </div>
                <div class="summary-card">
                  <div class="summary-card-label">Areas to Improve</div>
                  <div class="summary-card-value" style="font-size: 16px; color: #ed8936;">Review Recommendations</div>
                </div>
                <div class="summary-card">
                  <div class="summary-card-label">Analysis Date</div>
                  <div class="summary-card-value" style="font-size: 14px;">${execSummary.analysis_date || 'N/A'}</div>
                </div>
              </div>
              <div class="summary-text">
                This analysis provides detailed recommendations to strengthen your DPR submission. Review each section carefully and implement the suggested improvements to enhance your project proposal quality.
              </div>
            </div>
            
            ${(() => {
              const analysisData = document.analysisData;
              const insights = analysisData?.actionable_insights || analysisData?.analysis?.actionable_insights || [];
              
              if (insights && insights.length > 0) {
                return `
            <div class="recommendations-box">
              <h2>💡 Recommendations to Improve Your DPR</h2>
              <div class="recommendations-subtitle">
                Follow these expert recommendations to strengthen your project proposal and increase approval chances
              </div>
              ${insights.map((insight: any, index: number) => {
                // Extract priority if present
                let priority = 'medium';
                let text = insight;
                let category = '';
                
                if (insight.includes('PRIORITY 1') || insight.includes('CRITICAL') || insight.includes('HIGH PRIORITY')) {
                  priority = 'high';
                } else if (insight.includes('PRIORITY 2') || insight.includes('PRIORITY 3') || insight.includes('MEDIUM')) {
                  priority = 'medium';
                } else if (insight.includes('PRIORITY 4') || insight.includes('PRIORITY 5') || insight.includes('LOW')) {
                  priority = 'low';
                }
                
                // Extract category if present
                if (insight.includes('[') && insight.includes(']')) {
                  const categoryMatch = insight.match(/\\[(.*?)\\]/);
                  if (categoryMatch) {
                    category = categoryMatch[1];
                    text = insight.replace(/\\[.*?\\]/, '').replace(/PRIORITY \\d+ - /, '').trim();
                  }
                } else {
                  text = insight.replace(/PRIORITY \\d+ - /, '').trim();
                }
                
                return `
              <div class="recommendation-item">
                <span class="recommendation-priority ${priority}">Priority ${index + 1}</span>
                <div class="recommendation-text">${text}</div>
                ${category ? `<span class="recommendation-category">${category}</span>` : ''}
              </div>
                `;
              }).join('')}
            </div>
                `;
              }
              return '';
            })()}
            
            ${structuredAnalysis.budget_analysis ? `
            <div class="section">
              <h2>Budget Analysis</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.budget_analysis.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.timeline_evaluation ? `
            <div class="section">
              <h2>Timeline Evaluation</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.timeline_evaluation.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.technical_feasibility ? `
            <div class="section">
              <h2>Technical Feasibility</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.technical_feasibility.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.risk_assessment ? `
            <div class="section">
              <h2>Risk Assessment</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.risk_assessment.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.actionable_recommendations ? `
            <div class="section">
              <h2>Actionable Recommendations</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.actionable_recommendations.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.compliance_check ? `
            <div class="section">
              <h2>Compliance Check</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.compliance_check.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.final_assessment ? `
            <div class="section">
              <h2>Final Assessment</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.final_assessment.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            <div class="metadata">
              <strong>[METADATA] Report Metadata</strong><br>
              <strong>Generated:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}<br>
              <strong>Document ID:</strong> ${document.id}<br>
              <strong>Uploaded By:</strong> ${document.uploadedBy.name} (${document.uploadedBy.email})
            </div>
            
            <button onclick="window.print()" class="print-button">
              [PRINT] Print Report
            </button>
          </body>
          </html>
        `);
        reportWindow.document.close();
      }
    }
  };

  const handleViewAdminReport = (document: UploadedDocument) => {
    if (document.analysisData) {
      // Create admin-specific report with approval information
      const reportWindow = window.open('', '_blank');
      if (reportWindow) {
        const structuredAnalysis = document.analysisData.structured_analysis || {};
        const execSummary = structuredAnalysis.executive_summary || {};
        const approvalRec = document.analysisData.analysis?.approval_recommendation || document.analysisData.approval_recommendation;
        
        reportWindow.document.write(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>[ADMIN] DPR Analysis Report - ${document.name}</title>
            <meta charset="UTF-8">
            <style>
              * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              
              body {
                font-family: 'Inter', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
                max-width: 1000px;
                margin: 0 auto;
                padding: 40px 20px;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                color: #2d3748;
                line-height: 1.8;
              }
              
              .admin-header {
                background: linear-gradient(135deg, #e53e3e 0%, #c53030 100%);
                color: white;
                padding: 40px;
                border-radius: 15px;
                margin-bottom: 40px;
                box-shadow: 0 10px 40px rgba(229, 62, 62, 0.3);
              }
              
              .admin-header h1 {
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 20px;
                letter-spacing: -0.5px;
              }
              
              .admin-badge {
                display: inline-block;
                background: rgba(255, 255, 255, 0.2);
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 15px;
              }
              
              .header-info {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-top: 25px;
                padding-top: 25px;
                border-top: 1px solid rgba(255,255,255,0.2);
              }
              
              .header-info-item {
                display: flex;
                flex-direction: column;
              }
              
              .header-info-label {
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                opacity: 0.8;
                margin-bottom: 5px;
              }
              
              .header-info-value {
                font-size: 16px;
                font-weight: 600;
              }
              
              .approval-box {
                background: white;
                padding: 35px;
                margin-bottom: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                border-left: 5px solid #e53e3e;
              }
              
              .approval-box h2 {
                color: #e53e3e;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 25px;
                display: flex;
                align-items: center;
                gap: 10px;
              }
              
              .approval-decision {
                display: inline-block;
                padding: 12px 24px;
                border-radius: 25px;
                font-size: 16px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 20px;
              }
              
              .decision-approve { background: #c6f6d5; color: #22543d; }
              .decision-revise { background: #fed7d7; color: #742a2a; }
              .decision-reject { background: #feb2b2; color: #742a2a; }
              .decision-approve_with_conditions { background: #fef5e7; color: #744210; }
              
              .confidence-meter {
                background: #edf2f7;
                border-radius: 10px;
                padding: 15px;
                margin: 15px 0;
              }
              
              .confidence-bar {
                background: #e2e8f0;
                height: 8px;
                border-radius: 4px;
                overflow: hidden;
                margin-top: 8px;
              }
              
              .confidence-fill {
                height: 100%;
                border-radius: 4px;
                transition: width 0.3s ease;
              }
              
              .exec-summary-box {
                background: white;
                padding: 35px;
                margin-bottom: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                border-left: 5px solid #667eea;
              }
              
              .exec-summary-box h2 {
                color: #667eea;
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 25px;
              }
              
              .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
                margin-bottom: 25px;
              }
              
              .summary-card {
                background: #f7fafc;
                padding: 20px;
                border-radius: 8px;
                text-align: center;
                border: 2px solid #e2e8f0;
              }
              
              .summary-card-label {
                font-size: 12px;
                color: #718096;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 8px;
              }
              
              .summary-card-value {
                font-size: 24px;
                font-weight: 700;
                color: #2d3748;
              }
              
              .summary-card-value.approve {
                color: #48bb78;
              }
              
              .summary-card-value.revise {
                color: #ed8936;
              }
              
              .summary-card-value.reject {
                color: #f56565;
              }
              
              .summary-text {
                font-size: 16px;
                line-height: 1.8;
                color: #4a5568;
                padding: 20px;
                background: #edf2f7;
                border-radius: 8px;
              }
              
              .section {
                background: white;
                padding: 35px;
                margin-bottom: 25px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
              }
              
              .section h2 {
                color: #2d3748;
                font-size: 22px;
                font-weight: 700;
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 3px solid #667eea;
              }
              
              .section-content {
                font-size: 15px;
                line-height: 1.9;
                color: #4a5568;
                white-space: pre-wrap;
                word-wrap: break-word;
              }
              
              .metadata {
                background: #edf2f7;
                padding: 25px;
                border-radius: 8px;
                margin-top: 30px;
                font-size: 14px;
                color: #718096;
              }
              
              .print-button {
                position: fixed;
                bottom: 30px;
                right: 30px;
                padding: 15px 30px;
                background: #e53e3e;
                color: white;
                border: none;
                border-radius: 50px;
                cursor: pointer;
                font-size: 16px;
                font-weight: 600;
                box-shadow: 0 10px 30px rgba(229, 62, 62, 0.4);
                transition: all 0.3s ease;
              }
              
              .print-button:hover {
                background: #c53030;
                transform: translateY(-2px);
                box-shadow: 0 15px 40px rgba(229, 62, 62, 0.5);
              }
              
              @media print {
                body { 
                  background: white; 
                  padding: 20px;
                }
                .section, .exec-summary-box, .approval-box { 
                  box-shadow: none; 
                  border: 1px solid #e2e8f0; 
                  page-break-inside: avoid;
                }
                .print-button {
                  display: none;
                }
              }
              
              @media (max-width: 768px) {
                .summary-grid {
                  grid-template-columns: 1fr;
                }
                .header-info {
                  grid-template-columns: 1fr;
                }
              }
            </style>
          </head>
          <body>
            <div class="admin-header">
              <div class="admin-badge">🔒 Admin Access Only</div>
              <h1>[ADMIN] DPR Analysis Report</h1>
              <div class="header-info">
                <div class="header-info-item">
                  <span class="header-info-label">Document Name</span>
                  <span class="header-info-value">${document.name}</span>
                </div>
                <div class="header-info-item">
                  <span class="header-info-label">Upload Date</span>
                  <span class="header-info-value">${new Date(document.uploadDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                </div>
                <div class="header-info-item">
                  <span class="header-info-label">Status</span>
                  <span class="header-info-value">${document.status.toUpperCase()}</span>
                </div>
              </div>
            </div>
            
            ${approvalRec ? `
            <div class="approval-box">
              <h2>🎯 Approval Recommendation</h2>
              <div class="approval-decision decision-${(approvalRec.decision || '').toLowerCase().replace(/_/g, '_')}">
                ${approvalRec.decision || 'PENDING'}
              </div>
              
              ${approvalRec.confidence !== undefined ? `
              <div class="confidence-meter">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                  <span style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: #718096;">Confidence Level</span>
                  <span style="font-size: 14px; font-weight: 700; color: #2d3748;">${Math.round(approvalRec.confidence * 100)}%</span>
                </div>
                <div class="confidence-bar">
                  <div class="confidence-fill" style="width: ${approvalRec.confidence * 100}%; background: ${approvalRec.confidence > 0.7 ? '#48bb78' : approvalRec.confidence > 0.4 ? '#ed8936' : '#f56565'};"></div>
                </div>
              </div>
              ` : ''}
              
              ${approvalRec.reasoning ? `
              <div style="margin-top: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 10px;">Reasoning:</h3>
                <p style="line-height: 1.7; color: #4a5568;">${approvalRec.reasoning}</p>
              </div>
              ` : ''}
              
              ${approvalRec.conditions && approvalRec.conditions.length > 0 ? `
              <div style="margin-top: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: #2d3748; margin-bottom: 10px;">Approval Conditions:</h3>
                <ul style="margin-left: 20px; color: #4a5568;">
                  ${approvalRec.conditions.map((condition: any) => `<li style="margin-bottom: 5px;">${condition}</li>`).join('')}
                </ul>
              </div>
              ` : ''}
            </div>
            ` : ''}
            
            <div class="exec-summary-box">
              <h2>Executive Summary</h2>
              <div class="summary-grid">
                <div class="summary-card">
                  <div class="summary-card-label">Overall Score</div>
                  <div class="summary-card-value">${execSummary.overall_score || 'N/A'}</div>
                </div>
                <div class="summary-card">
                  <div class="summary-card-label">Recommendation</div>
                  <div class="summary-card-value ${(execSummary.recommendation || '').toLowerCase()}">${execSummary.recommendation || approvalRec?.decision || 'N/A'}</div>
                </div>
                <div class="summary-card">
                  <div class="summary-card-label">Analysis Date</div>
                  <div class="summary-card-value" style="font-size: 14px;">${execSummary.analysis_date || 'N/A'}</div>
                </div>
              </div>
              <div class="summary-text">
                ${execSummary.summary || 'No summary available'}
              </div>
            </div>
            
            ${structuredAnalysis.budget_analysis ? `
            <div class="section">
              <h2>Budget Analysis</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.budget_analysis.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.timeline_evaluation ? `
            <div class="section">
              <h2>Timeline Evaluation</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.timeline_evaluation.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.technical_feasibility ? `
            <div class="section">
              <h2>Technical Feasibility</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.technical_feasibility.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.risk_assessment ? `
            <div class="section">
              <h2>Risk Assessment</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.risk_assessment.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.actionable_recommendations ? `
            <div class="section">
              <h2>Actionable Recommendations</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.actionable_recommendations.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.compliance_check ? `
            <div class="section">
              <h2>Compliance Check</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.compliance_check.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            ${structuredAnalysis.final_assessment ? `
            <div class="section">
              <h2>Final Assessment</h2>
              <div class="section-content" style="line-height: 1.8; text-align: justify;">
                <p>${structuredAnalysis.final_assessment.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>
              </div>
            </div>
            ` : ''}
            
            <div class="metadata">
              <strong>[ADMIN METADATA] Report Metadata</strong><br>
              <strong>Generated:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}<br>
              <strong>Document ID:</strong> ${document.id}<br>
              <strong>Uploaded By:</strong> ${document.uploadedBy.name} (${document.uploadedBy.email})<br>
              <strong>Admin Access:</strong> Full analysis with approval recommendations
            </div>
            
            <button onclick="window.print()" class="print-button">
              [ADMIN] Print Report
            </button>
          </body>
          </html>
        `);
        reportWindow.document.close();
      }
    }
  };

  const handleSubmitToAdmin = async (document: UploadedDocument) => {
    // Update document status to "submitted" for admin review
    await updateDocumentStatus(
      document.id,
      'submitted',
      'Document submitted by client for admin review and approval decision.',
      { name: user?.name || 'Client', email: user?.email || 'client.user@project.in' }
    );
    
    // Show success message
    alert('✅ Document successfully submitted to admin for approval review!\n\nYour document is now in the review queue. You will be notified once the admin team completes their review and makes an approval decision.');
  };

  const handleDownloadReport = (document: UploadedDocument) => {
    if (document.analysisData) {
      const structuredAnalysis = document.analysisData.structured_analysis || {};
      
      // Create a formatted text report
      let reportText = `
================================================================================
                        DPR ANALYSIS REPORT
================================================================================

Document: ${document.name}
Upload Date: ${new Date(document.uploadDate).toLocaleDateString()}
Status: ${document.status.toUpperCase()}
Uploaded By: ${document.uploadedBy.name} (${document.uploadedBy.email})

================================================================================

`;

      if (structuredAnalysis.executive_summary) {
        reportText += `EXECUTIVE SUMMARY\n`;
        reportText += `================================================================================\n`;
        reportText += JSON.stringify(structuredAnalysis.executive_summary, null, 2);
        reportText += `\n\n`;
      }

      if (structuredAnalysis.budget_analysis) {
        reportText += `BUDGET ANALYSIS\n`;
        reportText += `================================================================================\n`;
        reportText += structuredAnalysis.budget_analysis;
        reportText += `\n\n`;
      }

      if (structuredAnalysis.timeline_evaluation) {
        reportText += `TIMELINE EVALUATION\n`;
        reportText += `================================================================================\n`;
        reportText += structuredAnalysis.timeline_evaluation;
        reportText += `\n\n`;
      }

      if (structuredAnalysis.technical_feasibility) {
        reportText += `TECHNICAL FEASIBILITY\n`;
        reportText += `================================================================================\n`;
        reportText += structuredAnalysis.technical_feasibility;
        reportText += `\n\n`;
      }

      if (structuredAnalysis.risk_assessment) {
        reportText += `RISK ASSESSMENT\n`;
        reportText += `================================================================================\n`;
        reportText += structuredAnalysis.risk_assessment;
        reportText += `\n\n`;
      }

      if (structuredAnalysis.actionable_recommendations) {
        reportText += `ACTIONABLE RECOMMENDATIONS\n`;
        reportText += `================================================================================\n`;
        reportText += structuredAnalysis.actionable_recommendations;
        reportText += `\n\n`;
      }

      if (structuredAnalysis.compliance_check) {
        reportText += `COMPLIANCE CHECK\n`;
        reportText += `================================================================================\n`;
        reportText += structuredAnalysis.compliance_check;
        reportText += `\n\n`;
      }

      if (structuredAnalysis.final_assessment) {
        reportText += `FINAL ASSESSMENT\n`;
        reportText += `================================================================================\n`;
        reportText += structuredAnalysis.final_assessment;
        reportText += `\n\n`;
      }

      reportText += `\n`;
      reportText += `================================================================================\n`;
      reportText += `Report Generated: ${new Date().toLocaleString()}\n`;
      reportText += `Document ID: ${document.id}\n`;
      reportText += `================================================================================\n`;

      // Create blob and download
      const blob = new Blob([reportText], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `DPR_Analysis_${document.name.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.txt`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownloadJSON = (document: UploadedDocument) => {
    if (document.analysisData) {
      // Download as JSON
      const blob = new Blob([JSON.stringify(document.analysisData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `DPR_Analysis_${document.name.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.json`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const getStatusBadge = (status: UploadedDocument['status']) => {
    const statusConfig = {
      'pending': { 
        bg: 'bg-yellow-900/50', 
        text: 'text-yellow-300', 
        border: 'border-yellow-500/30',
        icon: '⌛',
        label: 'Pending'
      },
      'viewed': { 
        bg: 'bg-blue-900/50', 
        text: 'text-blue-300', 
        border: 'border-blue-500/30',
        icon: '👁',
        label: 'Viewed'
      },
      'under-review': { 
        bg: 'bg-purple-900/50', 
        text: 'text-purple-300', 
        border: 'border-purple-500/30',
        icon: '🔎',
        label: 'Under Review'
      },
      'approved': { 
        bg: 'bg-green-900/50', 
        text: 'text-green-300', 
        border: 'border-green-500/30',
        icon: '✓',
        label: 'Approved'
      },
      'rejected': { 
        bg: 'bg-red-900/50', 
        text: 'text-red-300', 
        border: 'border-red-500/30',
        icon: '✗',
        label: 'Rejected'
      },
      'submitted': { 
        bg: 'bg-amber-900/50', 
        text: 'text-amber-300', 
        border: 'border-amber-500/30',
        icon: '📤',
        label: 'Submitted'
      }
    };

    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text} border ${config.border}`}>
        <span className="mr-1">{config.icon}</span>
        {config.label}
      </span>
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="w-full min-h-screen bg-black">
      <Navigation />
      
      {/* Document Upload Section */}
      <div className="w-full px-6 pt-32">
        <div id="manage-dpr" className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-white mb-2">Add & Manage DPR Documents</h2>
            <p className="text-gray-300 text-sm">Upload your DPR documents for AI-powered quality assessment and risk prediction</p>
          </div>

          {/* Upload Area */}
          <div className="border-2 border-dashed border-white/30 rounded-xl p-8 text-center mb-6 hover:border-blue-400/50 transition-colors duration-200">
            {!selectedFile ? (
              <div>
                <div className="mb-4">
                  <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                    <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="text-white mb-2">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="text-blue-300 hover:text-blue-400 font-medium">Click to upload</span>
                    <span className="text-gray-300"> or drag and drop</span>
                  </label>
                </div>
                <p className="text-gray-400 text-sm">PDF, DOC, DOCX up to 10MB</p>
                <input
                  id="file-upload"
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="flex items-center justify-between bg-white/10 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                    <svg className="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-gray-400 text-sm">{Math.round(selectedFile.size / 1024)} KB</p>
                  </div>
                </div>
                <button
                  onClick={handleRemoveFile}
                  className="text-red-400 hover:text-red-300 transition-colors"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* Upload Button */}
          {selectedFile && (
            <div className="flex flex-col items-center space-y-4">
              <button
                onClick={handleUpload}
                disabled={uploadStatus === 'uploading' || uploadStatus === 'processing'}
                className={`px-8 py-3 rounded-lg font-medium transition-all duration-200 ${
                  uploadStatus === 'uploading' || uploadStatus === 'processing'
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : uploadStatus === 'success'
                    ? 'bg-green-600 text-white'
                    : uploadStatus === 'error'
                    ? 'bg-red-600 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {uploadStatus === 'uploading' ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Analyzing...</span>
                  </div>
                ) : uploadStatus === 'processing' ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>AI Processing...</span>
                  </div>
                ) : uploadStatus === 'success' ? (
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Analysis Complete!</span>
                  </div>
                ) : uploadStatus === 'error' ? (
                  <div className="flex items-center space-x-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Upload Failed</span>
                  </div>
                ) : (
                  'Upload & Analyze Document'
                )}
              </button>
              
              {errorMessage && (
                <div className="text-red-400 text-sm bg-red-900/20 px-4 py-2 rounded-lg border border-red-500/30">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Uploaded Documents Section */}
        {uploadedDocuments.length > 0 && (
          <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl shadow-2xl p-8 mt-8">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-white mb-2">Uploaded Documents</h3>
              <p className="text-gray-300 text-sm">Track the status of your submitted DPR documents</p>
            </div>

            <div className="space-y-4">
              {uploadedDocuments.map((document) => (
                <div key={document.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors duration-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-white font-semibold text-sm">{document.name}</h4>
                        <p className="text-gray-400 text-xs">
                          {formatFileSize(document.size)} • Uploaded on {formatDate(document.uploadDate)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(document.status)}
                  </div>

                  {document.reviewerComments && (
                    <div className="bg-black/20 border border-white/10 rounded-lg p-3 mt-3">
                      <p className="text-xs text-gray-400 mb-1">Reviewer Comments:</p>
                      <p className="text-gray-300 text-sm">{document.reviewerComments}</p>
                    </div>
                  )}

                  {document.analysisData && document.analysisData.actionable_insights && document.analysisData.actionable_insights.length > 0 && (
                    <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4 mt-3">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        <p className="text-xs font-semibold text-purple-300">Key Recommendations:</p>
                      </div>
                      <ul className="space-y-1">
                        {document.analysisData.actionable_insights.slice(0, 3).map((insight: string, idx: number) => (
                          <li key={idx} className="text-xs text-gray-300 flex items-start gap-2">
                            <span className="text-purple-400 mt-0.5">•</span>
                            <span className="line-clamp-2">{insight.replace(/PRIORITY \d+ - /, '').replace(/\[.*?\]/, '').substring(0, 120)}...</span>
                          </li>
                        ))}
                      </ul>
                      {document.analysisData.actionable_insights.length > 3 && (
                        <p className="text-xs text-purple-400 mt-2 font-medium">
                          +{document.analysisData.actionable_insights.length - 3} more recommendations • Click "View Report" to see all
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleViewReport(document)}
                        disabled={!document.analysisData}
                        className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                          document.analysisData 
                            ? 'text-blue-300 hover:text-blue-400 cursor-pointer' 
                            : 'text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        View Report
                      </button>
                      <button 
                        onClick={() => handleDownloadReport(document)}
                        disabled={!document.analysisData}
                        className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                          document.analysisData 
                            ? 'text-green-300 hover:text-green-400 cursor-pointer' 
                            : 'text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Download TXT
                      </button>
                      <button 
                        onClick={() => handleDownloadJSON(document)}
                        disabled={!document.analysisData}
                        className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                          document.analysisData 
                            ? 'text-purple-300 hover:text-purple-400 cursor-pointer' 
                            : 'text-gray-500 cursor-not-allowed'
                        }`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Download JSON
                      </button>
                      {document.status !== 'submitted' && (
                        <button 
                          onClick={() => handleSubmitToAdmin(document)}
                          disabled={!document.analysisData}
                          className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                            document.analysisData 
                              ? 'text-amber-300 hover:text-amber-400 cursor-pointer' 
                              : 'text-gray-500 cursor-not-allowed'
                          }`}
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                          Submit to Admin
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      ID: {document.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortalContent;