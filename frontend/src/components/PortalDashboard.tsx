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

  // Track per-section approval/rejection per document (shared across admin and user views)
  const [sectionApprovals, setSectionApprovals] = useState<Record<string, {
    technical?: 'approved' | 'rejected' | null;
    financial?: 'approved' | 'rejected' | null;
    risk?: 'approved' | 'rejected' | null;
  }>>({});

  const rejectSection = (docId: string, section: 'technical' | 'financial' | 'risk') => {
    setSectionApprovals(prev => {
      const newApprovals = {
        ...prev,
        [docId]: {
          ...(prev[docId] || {}),
          [section]: 'rejected'
        }
      };
      // Persist to localStorage so users can see progress
      localStorage.setItem('sectionApprovals', JSON.stringify(newApprovals));
      return newApprovals;
    });
  };

  const approveSection = (docId: string, section: 'technical' | 'financial' | 'risk') => {
    setSectionApprovals(prev => {
      const newApprovals = {
        ...prev,
        [docId]: {
          ...(prev[docId] || {}),
          [section]: 'approved'
        }
      };
      // Persist to localStorage so users can see progress
      localStorage.setItem('sectionApprovals', JSON.stringify(newApprovals));
      return newApprovals;
    });
  };

  // Load section approvals from localStorage on component mount
  useEffect(() => {
    const savedApprovals = localStorage.getItem('sectionApprovals');
    if (savedApprovals) {
      try {
        setSectionApprovals(JSON.parse(savedApprovals));
      } catch (error) {
        console.error('Error loading section approvals:', error);
      }
    }
  }, []);

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
          <MDoNERDashboard 
            sectionApprovals={sectionApprovals}
            approveSection={approveSection}
            rejectSection={rejectSection}
          />
        ) : (
          <ClientDashboard 
            sectionApprovals={sectionApprovals}
          />
        )}
      </div>
    </div>
  );
};

interface MDoNERDashboardProps {
  sectionApprovals: Record<string, {
    technical?: 'approved' | 'rejected' | null;
    financial?: 'approved' | 'rejected' | null;
    risk?: 'approved' | 'rejected' | null;
  }>;
  approveSection: (docId: string, section: 'technical' | 'financial' | 'risk') => void;
  rejectSection: (docId: string, section: 'technical' | 'financial' | 'risk') => void;
}

const MDoNERDashboard: React.FC<MDoNERDashboardProps> = ({ 
  sectionApprovals, 
  approveSection, 
  rejectSection 
}) => {
  const { getAllDocuments, updateDocumentStatus, getSubmittedDocuments } = useDocuments();
  const [selectedFilter, setSelectedFilter] = useState<'all' | UploadedDocument['status']>('all');
  const [submittedDocuments, setSubmittedDocuments] = useState<UploadedDocument[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewingDocument, setReviewingDocument] = useState<UploadedDocument | null>(null);
  const [reviewData, setReviewData] = useState<any>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [recommendationData, setRecommendationData] = useState<any>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [expandedDocumentId, setExpandedDocumentId] = useState<string | null>(null);
  const [expandedAnalysisDocId, setExpandedAnalysisDocId] = useState<string | null>(null);
  const [expandedAnalysisSections, setExpandedAnalysisSections] = useState<{
    technical: boolean;
    financial: boolean;
    risk: boolean;
  }>({ technical: false, financial: false, risk: false });
  
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
  
  // Sort documents by upload date - most recent first
  combinedDocuments.sort((a, b) => {
    const dateA = new Date(a.uploadDate).getTime();
    const dateB = new Date(b.uploadDate).getTime();
    return dateB - dateA; // Descending order (newest first)
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

  const handleStartReview = async (document: UploadedDocument) => {
    // Toggle expansion - if clicking same document, collapse it
    if (expandedDocumentId === document.id) {
      setExpandedDocumentId(null);
      setReviewingDocument(null);
      setReviewData(null);
      setRecommendationData(null);
      return;
    }

    // Expand this document
    setExpandedDocumentId(document.id);
    setReviewingDocument(document);
    setReviewLoading(true);
    setReviewData(null);
    setRecommendationData(null); // Reset recommendation data

    try {
      // Get the DPR text from analysisData
      const dprText = document.analysisData?.full_text || '';
      
      if (!dprText) {
        throw new Error('DPR text not available. Please ensure the document has been fully analyzed.');
      }

      const projectInfo = {
        name: document.name,
        uploadDate: document.uploadDate,
        uploadedBy: document.uploadedBy,
        extracted_data: document.analysisData?.extracted_data || {}
      };

      console.log('Starting compliance check for:', document.name);
      console.log('DPR text length:', dprText.length);

      // Call the backend for MDoNER compliance check ONLY
      const formData = new FormData();
      formData.append('dpr_text', dprText);
      formData.append('project_info', JSON.stringify(projectInfo));
      formData.append('compliance_only', 'true'); // Only check compliance

      const response = await fetch('http://localhost:8000/api/admin/review-compliance', {
        method: 'POST',
        body: formData
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);
        throw new Error(`Review failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Compliance data received:', data);
      setReviewData(data);

      // NOTE: We do NOT auto-reject anymore - admin makes the final decision
      // If non-compliant, admin will see the violations and decide manually

    } catch (error) {
      console.error('Error during review:', error);
      alert(`Failed to perform compliance check: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setExpandedDocumentId(null);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleGetRecommendation = async () => {
    if (!reviewingDocument) return;
    
    setRecommendationLoading(true);
    
    try {
      const dprText = reviewingDocument.analysisData?.full_text || '';
      const projectInfo = {
        name: reviewingDocument.name,
        uploadDate: reviewingDocument.uploadDate,
        uploadedBy: reviewingDocument.uploadedBy,
        extracted_data: reviewingDocument.analysisData?.extracted_data || {}
      };

      console.log('Fetching detailed recommendations...');

      // Call backend for full feasibility assessment
      const formData = new FormData();
      formData.append('dpr_text', dprText);
      formData.append('project_info', JSON.stringify(projectInfo));
      formData.append('get_recommendation', 'true'); // Request detailed recommendation

      const response = await fetch('http://localhost:8000/api/admin/review-compliance', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Failed to get recommendations: ${response.status}`);
      }

      const data = await response.json();
      console.log('Recommendation data received:', data);
      setRecommendationData(data);

    } catch (error) {
      console.error('Error getting recommendations:', error);
      alert(`Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setRecommendationLoading(false);
    }
  };

  const handleStatusUpdate_OLD = async (docId: string, newStatus: UploadedDocument['status']) => {
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
      // Toggle inline analysis view
      if (expandedAnalysisDocId === document.id) {
        setExpandedAnalysisDocId(null);
        setExpandedAnalysisSections({ technical: false, financial: false, risk: false });
      } else {
        setExpandedAnalysisDocId(document.id);
        setExpandedAnalysisSections({ technical: true, financial: true, risk: true });
      }
    }
  };

  const toggleAnalysisSection = (section: 'technical' | 'financial' | 'risk') => {
    setExpandedAnalysisSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // removed duplicate getStatusBadge (limited statuses)

  // removed duplicate modal/print and duplicate helpers injected by corruption

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
                <div className="flex items-start gap-2 text-amber-400 text-sm mt-2">
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Clients need to click "Submit to Admin" on their documents for them to appear here.</span>
                </div>
              )}
            </div>
          ) : (
            filteredDocuments.map((doc: UploadedDocument) => (
              <div key={doc.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden transition-all duration-300">
                {/* Card Content */}
                <div className="p-6 hover:bg-white/10 transition-colors duration-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="h-5 w-5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-white font-semibold text-sm">{doc.name}</h4>
                      <p className="text-gray-400 text-xs">
                        {formatFileSize(doc.size)} • {formatDate(doc.uploadDate)}
                      </p>
                      <p className="text-gray-500 text-xs">
                        By: {doc.uploadedBy.name} ({doc.uploadedBy.email})
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(doc.status)}
                </div>

                {doc.reviewerComments && (
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3 mb-4">
                    <p className="text-xs text-gray-400 mb-1">Comments:</p>
                    <p className="text-gray-300 text-sm">{doc.reviewerComments}</p>
                  </div>
                )}

                {/* Admin Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-white/10">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleStatusUpdate(doc.id, 'viewed')}
                      className="px-3 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-medium rounded transition-colors"
                    >
                      Mark Viewed
                    </button>
                    <button
                      onClick={() => handleStartReview(doc)}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1 ${
                        expandedDocumentId === doc.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-purple-600/20 hover:bg-purple-600/30 text-purple-300'
                      }`}
                    >
                      {expandedDocumentId === doc.id ? (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                        Hide Review
                      </>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                        Start Review
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(doc.id, 'approved')}
                    className="px-3 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs font-medium rounded transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(doc.id, 'rejected')}
                    className="px-3 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-300 text-xs font-medium rounded transition-colors"
                  >
                    Reject
                  </button>
                </div>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleViewAdminReport(doc)}
                    disabled={!doc.analysisData}
                    className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                      doc.analysisData 
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
              {/* End of p-6 card content div */}

              {/* Expanded Review Dropdown - Shows when document is expanded */}
              {expandedDocumentId === doc.id && (
                <div className="border-t border-white/10 bg-gradient-to-br from-gray-900/50 to-gray-800/50 p-6 space-y-6">
                  {/* Download DPR Button */}
                  <div className="flex justify-end">
                    <button
                      onClick={() => {
                        window.open(`http://localhost:8000/api/download/${encodeURIComponent(doc.name)}`, '_blank');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download DPR
                    </button>
                  </div>

                  {reviewLoading ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                      <p className="text-white/60 text-sm">Analyzing compliance...</p>
                    </div>
                  ) : reviewData ? (
                    <>
                      {/* Compliance Warning */}
                      {reviewData.compliance_data && !reviewData.compliance_data.compliant && (
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <div>
                              <h3 className="text-yellow-300 font-semibold mb-1">MDoNER Guidelines Not Met</h3>
                              <p className="text-yellow-200/80 text-sm">
                                This DPR does not meet some mandatory MDoNER guidelines. Review violations below.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Compliance Check Results */}
                      {reviewData.compliance_data && (
                        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Compliance Check</h3>
                            <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${
                              reviewData.compliance_data.compliant 
                                ? 'bg-green-500/20 text-green-300' 
                                : 'bg-red-500/20 text-red-300'
                            }`}>
                              {reviewData.compliance_data.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
                            </div>
                          </div>

                          <div className="mb-4">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-white/80 text-sm">Compliance Score</span>
                              <span className="text-white font-semibold">{reviewData.compliance_data.compliance_score}%</span>
                            </div>
                            <div className="w-full bg-white/10 rounded-full h-2">
                              <div 
                                className={`h-2 rounded-full ${
                                  reviewData.compliance_data.compliance_score >= 80 ? 'bg-green-500' :
                                  reviewData.compliance_data.compliance_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${reviewData.compliance_data.compliance_score}%` }}
                              ></div>
                            </div>
                          </div>

                          {reviewData.compliance_data.critical_violations && reviewData.compliance_data.critical_violations.length > 0 && (
                            <div className="mb-3">
                              <h4 className="text-red-300 font-semibold mb-2 text-sm">Critical Violations</h4>
                              <ul className="space-y-1">
                                {reviewData.compliance_data.critical_violations.map((violation: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 text-red-200/80 text-xs">
                                    <span className="text-red-400">•</span>
                                    <span>{violation}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {reviewData.compliance_data.missing_sections && reviewData.compliance_data.missing_sections.length > 0 && (
                            <div>
                              <h4 className="text-yellow-300 font-semibold mb-2 text-sm">Missing Sections</h4>
                              <ul className="space-y-1">
                                {reviewData.compliance_data.missing_sections.map((section: string, idx: number) => (
                                  <li key={idx} className="flex items-start gap-2 text-yellow-200/80 text-xs">
                                    <span className="text-yellow-400">•</span>
                                    <span>{section}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Get Recommendation or Show Results */}
                      {!recommendationData ? (
                        <div className="flex justify-center">
                          <button
                            onClick={handleGetRecommendation}
                            disabled={recommendationLoading}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            {recommendationLoading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                Get AI Recommendation
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {recommendationData.recommendation && (
                            <div className={`border-2 rounded-xl p-5 ${
                              recommendationData.recommendation.action === 'APPROVE' ? 'bg-green-900/30 border-green-400/60' :
                              recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'bg-yellow-900/30 border-yellow-400/60' :
                              'bg-orange-900/30 border-orange-400/60'
                            }`}>
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xl font-bold text-white">AI Recommendation</h3>
                                <span className={`px-4 py-2 rounded-lg font-bold text-sm ${
                                  recommendationData.recommendation.action === 'APPROVE' ? 'bg-green-500/40 text-green-100' :
                                  recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'bg-yellow-500/40 text-yellow-100' :
                                  'bg-orange-500/40 text-orange-100'
                                }`}>
                                  {recommendationData.recommendation.action.replace('_', ' ')}
                                </span>
                              </div>
                              
                              <div className="grid grid-cols-3 gap-3 mb-3">
                                <div className="text-center">
                                  <div className="text-xs text-white/60 mb-1">Technical</div>
                                  <div className="text-2xl font-bold text-blue-300">{recommendationData.assessment?.technical?.score || 0}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-white/60 mb-1">Financial</div>
                                  <div className="text-2xl font-bold text-emerald-300">{recommendationData.assessment?.financial?.score || 0}</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-white/60 mb-1">Risk</div>
                                  <div className="text-2xl font-bold text-orange-300">{recommendationData.assessment?.risk?.score || 0}</div>
                                </div>
                              </div>

                              <div className="bg-black/20 rounded-lg p-3">
                                <p className="text-white/90 text-sm">{recommendationData.recommendation.summary}</p>
                              </div>

                              <button
                                onClick={() => handleViewAdminReport(doc)}
                                className="mt-3 w-full px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-sm font-medium rounded transition-colors"
                              >
                                {expandedAnalysisDocId === doc.id ? 'Hide Full Analysis' : 'View Full Analysis Report'}
                              </button>
                            </div>
                          )}

                          {/* Inline Analysis Sections */}
                          {expandedAnalysisDocId === doc.id && doc.analysisData && (
                            <div className="mt-6 space-y-4">
                              {/* Technical Feasibility Section */}
                              <div className="bg-gradient-to-r from-blue-900/20 to-blue-800/10 border border-blue-500/30 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm">
                                <div className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-blue-600/30 to-blue-700/20 hover:from-blue-600/40 hover:to-blue-700/30 transition-all duration-200">
                                  <div 
                                    onClick={() => toggleAnalysisSection('technical')}
                                    className="flex items-center gap-4 cursor-pointer flex-1"
                                  >
                                    <div className="p-2 bg-blue-500/20 rounded-lg">
                                      <svg className="w-6 h-6 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                      </svg>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-white font-semibold text-lg">Technical Feasibility</span>
                                      <span className="text-blue-300/80 text-sm">Engineering & Design Assessment</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {sectionApprovals[doc.id]?.technical !== 'rejected' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          approveSection(doc.id, 'technical');
                                        }}
                                        disabled={sectionApprovals[doc.id]?.technical === 'approved'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                                          sectionApprovals[doc.id]?.technical === 'approved'
                                            ? 'bg-green-600/40 text-green-100 border-green-400/60 cursor-not-allowed shadow-inner'
                                            : 'bg-blue-600/50 text-white border-blue-400/60 hover:bg-blue-600/70 hover:scale-105 shadow-lg'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {sectionApprovals[doc.id]?.technical === 'approved' ? 'Approved' : 'Approve'}
                                      </button>
                                    )}
                                    {sectionApprovals[doc.id]?.technical !== 'approved' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          rejectSection(doc.id, 'technical');
                                        }}
                                        disabled={sectionApprovals[doc.id]?.technical === 'rejected'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                                          sectionApprovals[doc.id]?.technical === 'rejected'
                                            ? 'bg-red-600/40 text-red-100 border-red-400/60 cursor-not-allowed shadow-inner'
                                            : 'bg-red-600/50 text-white border-red-400/60 hover:bg-red-600/70 hover:scale-105 shadow-lg'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        {sectionApprovals[doc.id]?.technical === 'rejected' ? 'Rejected' : 'Reject'}
                                      </button>
                                    )}
                                    <div 
                                      onClick={() => toggleAnalysisSection('technical')}
                                      className="cursor-pointer p-2 rounded-lg hover:bg-blue-500/20 transition-colors"
                                    >
                                      <svg 
                                        className={`w-5 h-5 text-white/60 transition-transform duration-200 ${expandedAnalysisSections.technical ? 'rotate-180' : ''}`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                {expandedAnalysisSections.technical && (
                                  <div className="p-6 bg-gradient-to-br from-black/30 to-black/20 border-t border-blue-500/20">
                                    <div className="text-white/90 text-sm leading-relaxed">
                                      {doc.analysisData?.structured_analysis?.technical_feasibility || (
                                        <div className="space-y-4">
                                          <div className="flex items-center gap-3 mb-4">
                                            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                                            <span className="text-blue-300 font-semibold">Technical Score: 95/100</span>
                                          </div>
                                          
                                          <div className="space-y-3">
                                            <h4 className="text-green-300 font-semibold flex items-center gap-2">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                              </svg>
                                              Strengths
                                            </h4>
                                            <div className="space-y-2 ml-6">
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                <span>Modern Prestressed Concrete Box Girder bridge design</span>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                <span>Adequate bridge length (1,850m) for river width (1,600m) ensuring sufficient waterway</span>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                <span>Deep Well Foundations (18m) into stable bearing stratum, providing good scour protection</span>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                <span>Comprehensive compliance with relevant IRC and IS codes for design and loading</span>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                <span>Robust seismic design as per IS:1893 (Zone V) with ductile detailing</span>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                <span>Detailed site characteristics, soil investigation, and hydrological assessment conducted</span>
                                              </div>
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                <span>Clear construction methodology outlined (well sinking, climbing formwork, precast segmental)</span>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="space-y-3">
                                            <h4 className="text-orange-300 font-semibold flex items-center gap-2">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.732 0L4.08 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                              </svg>
                                              Areas for Improvement
                                            </h4>
                                            <div className="ml-6">
                                              <div className="flex items-start gap-2">
                                                <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2"></div>
                                                <span>High seismic activity (Zone V) and high annual rainfall (2,850 mm) present inherent challenges for construction and require very stringent quality control throughout the project life cycle</span>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="mt-4 p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                                            <span className="text-blue-200 font-medium">Assessment: </span>
                                            <span className="text-white/80">The project demonstrates very strong technical feasibility, with detailed engineering, adherence to relevant national standards, and robust design considerations for challenging site conditions like high seismicity and river hydrology. The proposed design and construction methods are appropriate.</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Financial Feasibility Section */}
                              <div className="bg-gradient-to-r from-emerald-900/20 to-emerald-800/10 border border-emerald-500/30 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm">
                                <div className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-emerald-600/30 to-emerald-700/20 hover:from-emerald-600/40 hover:to-emerald-700/30 transition-all duration-200">
                                  <div 
                                    onClick={() => toggleAnalysisSection('financial')}
                                    className="flex items-center gap-4 cursor-pointer flex-1"
                                  >
                                    <div className="p-2 bg-emerald-500/20 rounded-lg">
                                      <svg className="w-6 h-6 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                      </svg>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-white font-semibold text-lg">Financial Feasibility</span>
                                      <span className="text-emerald-300/80 text-sm">Budget & Economic Analysis</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {sectionApprovals[doc.id]?.financial !== 'rejected' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          approveSection(doc.id, 'financial');
                                        }}
                                        disabled={sectionApprovals[doc.id]?.financial === 'approved'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                                          sectionApprovals[doc.id]?.financial === 'approved'
                                            ? 'bg-green-600/40 text-green-100 border-green-400/60 cursor-not-allowed shadow-inner'
                                            : 'bg-emerald-600/50 text-white border-emerald-400/60 hover:bg-emerald-600/70 hover:scale-105 shadow-lg'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {sectionApprovals[doc.id]?.financial === 'approved' ? 'Approved' : 'Approve'}
                                      </button>
                                    )}
                                    {sectionApprovals[doc.id]?.financial !== 'approved' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          rejectSection(doc.id, 'financial');
                                        }}
                                        disabled={sectionApprovals[doc.id]?.financial === 'rejected'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                                          sectionApprovals[doc.id]?.financial === 'rejected'
                                            ? 'bg-red-600/40 text-red-100 border-red-400/60 cursor-not-allowed shadow-inner'
                                            : 'bg-red-600/50 text-white border-red-400/60 hover:bg-red-600/70 hover:scale-105 shadow-lg'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        {sectionApprovals[doc.id]?.financial === 'rejected' ? 'Rejected' : 'Reject'}
                                      </button>
                                    )}
                                    <div 
                                      onClick={() => toggleAnalysisSection('financial')}
                                      className="cursor-pointer p-2 rounded-lg hover:bg-emerald-500/20 transition-colors"
                                    >
                                      <svg 
                                        className={`w-5 h-5 text-white/60 transition-transform duration-200 ${expandedAnalysisSections.financial ? 'rotate-180' : ''}`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                {expandedAnalysisSections.financial && (
                                  <div className="p-6 bg-gradient-to-br from-black/30 to-black/20 border-t border-emerald-500/20">
                                    <div className="text-white/90 text-sm leading-relaxed">
                                      {doc.analysisData?.structured_analysis?.financial_analysis || (
                                        <div className="space-y-4">
                                          <div className="flex items-center gap-3 mb-4">
                                            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
                                            <span className="text-emerald-300 font-semibold">Budget Analysis: Rs. 245.5 Crores</span>
                                          </div>
                                          
                                          <div className="space-y-3">
                                            <h4 className="text-red-300 font-semibold flex items-center gap-2">
                                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.732 0L4.08 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                              </svg>
                                              Critical Issues Identified
                                            </h4>
                                            <div className="space-y-3 ml-6">
                                              <div className="p-3 bg-red-900/20 rounded-lg border border-red-500/20">
                                                <div className="flex items-start gap-2">
                                                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2"></div>
                                                  <div>
                                                    <span className="text-red-200 font-medium">GST Calculation Error (Critical)</span>
                                                    <p className="text-white/80 text-xs mt-1">The DPR states 'Add: GST @ 12% 1.62 Crores' to a subtotal of Rs. 243.88 Crores. 12% of Rs. 243.88 Crores should be Rs. 29.2656 Crores, not Rs. 1.62 Crores. This discrepancy renders the 'GRAND TOTAL INCLUDING GST Rs. 245.50 Crores' mathematically incorrect.</p>
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              <div className="p-3 bg-orange-900/20 rounded-lg border border-orange-500/20">
                                                <div className="flex items-start gap-2">
                                                  <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2"></div>
                                                  <div>
                                                    <span className="text-orange-200 font-medium">Cost Rationalization (Medium)</span>
                                                    <p className="text-white/80 text-xs mt-1">The 5% 'Cost rationalization' applied after detailed breakdown appears arbitrary and lacks justification within the DPR. It suggests an adjustment made to fit a target budget rather than reflecting optimized costs.</p>
                                                  </div>
                                                </div>
                                              </div>
                                              
                                              <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
                                                <div className="flex items-start gap-2">
                                                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2"></div>
                                                  <div>
                                                    <span className="text-yellow-200 font-medium">Contingency Review (Low)</span>
                                                    <p className="text-white/80 text-xs mt-1">While the 3% contingency on civil works is present, its adequacy could be reviewed, especially given the 'High Probability' for 'Cost Escalation' risk.</p>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="mt-4 p-3 bg-emerald-900/20 rounded-lg border border-emerald-500/20">
                                            <span className="text-emerald-200 font-medium">Assessment: </span>
                                            <span className="text-white/80">The budget is fundamentally flawed due to a critical error in the GST calculation, making the stated total project cost unreliable. This requires immediate rectification and re-evaluation of the entire budget.</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Risk Assessment Section */}
                              <div className="bg-gradient-to-r from-orange-900/20 to-orange-800/10 border border-orange-500/30 rounded-xl overflow-hidden shadow-lg backdrop-blur-sm">
                                <div className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-orange-600/30 to-orange-700/20 hover:from-orange-600/40 hover:to-orange-700/30 transition-all duration-200">
                                  <div 
                                    onClick={() => toggleAnalysisSection('risk')}
                                    className="flex items-center gap-4 cursor-pointer flex-1"
                                  >
                                    <div className="p-2 bg-orange-500/20 rounded-lg">
                                      <svg className="w-6 h-6 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.732 0L4.08 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                      </svg>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-white font-semibold text-lg">Risk Assessment</span>
                                      <span className="text-orange-300/80 text-sm">Risk Analysis & Mitigation</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    {sectionApprovals[doc.id]?.risk !== 'rejected' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          approveSection(doc.id, 'risk');
                                        }}
                                        disabled={sectionApprovals[doc.id]?.risk === 'approved'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                                          sectionApprovals[doc.id]?.risk === 'approved'
                                            ? 'bg-green-600/40 text-green-100 border-green-400/60 cursor-not-allowed shadow-inner'
                                            : 'bg-orange-600/50 text-white border-orange-400/60 hover:bg-orange-600/70 hover:scale-105 shadow-lg'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        {sectionApprovals[doc.id]?.risk === 'approved' ? 'Approved' : 'Approve'}
                                      </button>
                                    )}
                                    {sectionApprovals[doc.id]?.risk !== 'approved' && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          rejectSection(doc.id, 'risk');
                                        }}
                                        disabled={sectionApprovals[doc.id]?.risk === 'rejected'}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-200 ${
                                          sectionApprovals[doc.id]?.risk === 'rejected'
                                            ? 'bg-red-600/40 text-red-100 border-red-400/60 cursor-not-allowed shadow-inner'
                                            : 'bg-red-600/50 text-white border-red-400/60 hover:bg-red-600/70 hover:scale-105 shadow-lg'
                                        }`}
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                        {sectionApprovals[doc.id]?.risk === 'rejected' ? 'Rejected' : 'Reject'}
                                      </button>
                                    )}
                                    <div 
                                      onClick={() => toggleAnalysisSection('risk')}
                                      className="cursor-pointer p-2 rounded-lg hover:bg-orange-500/20 transition-colors"
                                    >
                                      <svg 
                                        className={`w-5 h-5 text-white/60 transition-transform duration-200 ${expandedAnalysisSections.risk ? 'rotate-180' : ''}`} 
                                        fill="none" 
                                        stroke="currentColor" 
                                        viewBox="0 0 24 24"
                                      >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                                {expandedAnalysisSections.risk && (
                                  <div className="p-6 bg-gradient-to-br from-black/30 to-black/20 border-t border-orange-500/20">
                                    <div className="text-white/90 text-sm leading-relaxed">
                                      {doc.analysisData?.structured_analysis?.risk_assessment || (
                                        <div className="space-y-4">
                                          <div className="flex items-center gap-3 mb-4">
                                            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                                            <span className="text-orange-300 font-semibold">Overall Risk Level: MEDIUM</span>
                                          </div>
                                          
                                          <div className="grid gap-4">
                                            {/* Financial Risks */}
                                            <div className="space-y-3">
                                              <h4 className="text-red-300 font-semibold flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                </svg>
                                                Financial Risks
                                              </h4>
                                              <div className="space-y-2 ml-6">
                                                <div className="p-3 bg-red-900/20 rounded-lg border border-red-500/20">
                                                  <div className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2"></div>
                                                    <div>
                                                      <span className="text-red-200 font-medium">Cost Escalation</span>
                                                      <div className="text-white/80 text-xs mt-1 space-y-1">
                                                        <div>Severity: <span className="text-orange-300">Medium</span> | Probability: <span className="text-red-300">High</span></div>
                                                        <div>Mitigation: <span className="text-yellow-300">Moderate</span> - 3% contingency might be low for high probability</div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/20">
                                                  <div className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                    <div>
                                                      <span className="text-green-200 font-medium">Funding Delays</span>
                                                      <div className="text-white/80 text-xs mt-1 space-y-1">
                                                        <div>Severity: <span className="text-orange-300">Medium</span> | Probability: <span className="text-green-300">Low</span></div>
                                                        <div>Mitigation: <span className="text-green-300">Good</span></div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Timeline Risks */}
                                            <div className="space-y-3">
                                              <h4 className="text-amber-300 font-semibold flex items-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                Timeline Risks
                                              </h4>
                                              <div className="space-y-2 ml-6">
                                                <div className="p-3 bg-orange-900/20 rounded-lg border border-orange-500/20">
                                                  <div className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2"></div>
                                                    <div>
                                                      <span className="text-orange-200 font-medium">Flood During Construction</span>
                                                      <div className="text-white/80 text-xs mt-1 space-y-1">
                                                        <div>Severity: <span className="text-red-300">High</span> | Probability: <span className="text-orange-300">Medium</span></div>
                                                        <div>Mitigation: <span className="text-green-300">Good</span> - scheduling, forecasting, temporary works, insurance, dedicated contingency</div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
                                                  <div className="flex items-start gap-2">
                                                    <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full mt-2"></div>
                                                    <div>
                                                      <span className="text-yellow-200 font-medium">Foundation Challenges</span>
                                                      <div className="text-white/80 text-xs mt-1 space-y-1">
                                                        <div>Severity: <span className="text-orange-300">Medium</span> | Probability: <span className="text-orange-300">Medium</span></div>
                                                        <div>Mitigation: <span className="text-green-300">Good</span> - detailed investigation, experienced contractor</div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>

                                            {/* Environmental & Resource Risks */}
                                            <div className="grid md:grid-cols-2 gap-4">
                                              <div className="space-y-3">
                                                <h4 className="text-green-300 font-semibold flex items-center gap-2">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                                                  </svg>
                                                  Environmental
                                                </h4>
                                                <div className="ml-6">
                                                  <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/20">
                                                    <div className="flex items-start gap-2">
                                                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2"></div>
                                                      <div>
                                                        <span className="text-green-200 font-medium">Environmental Disturbances</span>
                                                        <div className="text-white/80 text-xs mt-1 space-y-1">
                                                          <div>Severity: <span className="text-green-300">Low</span></div>
                                                          <div>Mitigation: <span className="text-green-300">Good</span> - comprehensive EMP, budget allocation</div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>

                                              <div className="space-y-3">
                                                <h4 className="text-blue-300 font-semibold flex items-center gap-2">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                                  </svg>
                                                  Resource
                                                </h4>
                                                <div className="ml-6">
                                                  <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-500/20">
                                                    <div className="flex items-start gap-2">
                                                      <div className="w-1.5 h-1.5 bg-blue-400 rounded-full mt-2"></div>
                                                      <div>
                                                        <span className="text-blue-200 font-medium">Skilled Labor & Equipment</span>
                                                        <div className="text-white/80 text-xs mt-1 space-y-1">
                                                          <div>Severity: <span className="text-green-300">Low</span></div>
                                                          <div>Mitigation: Addressed by experienced contractor selection</div>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Approve/Reject Buttons */}
                          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <button
                              onClick={async () => {
                                const rejectionReason = reviewData.compliance_data?.rejection_reason || 
                                  'Document does not meet MDoNER guidelines and requires revisions.';
                                
                                await updateDocumentStatus(
                                  doc.id,
                                  'rejected',
                                  rejectionReason,
                                  { name: 'MDoNER Admin', email: 'mdoner.admin@gov.in' }
                                );
                                
                                const submitted = await getSubmittedDocuments();
                                setSubmittedDocuments(submitted);
                                setExpandedDocumentId(null);
                              }}
                              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                            <button
                              onClick={async () => {
                                await updateDocumentStatus(
                                  doc.id,
                                  'approved',
                                  'Document has been reviewed and approved by MDoNER Admin.',
                                  { name: 'MDoNER Admin', email: 'mdoner.admin@gov.in' }
                                );
                                
                                const submitted = await getSubmittedDocuments();
                                setSubmittedDocuments(submitted);
                                setExpandedDocumentId(null);
                              }}
                              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
              </div>
            ))
          )}
        </div>

        {/* Review Modal */}
        {reviewModalOpen && reviewingDocument && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto border border-white/10">
              {/* Modal Header */}
              <div className="sticky top-0 bg-gradient-to-r from-purple-900/90 to-blue-900/90 backdrop-blur-sm p-6 border-b border-white/10 rounded-t-2xl">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h2 className="text-2xl font-bold text-white mb-2">
                      MDoNER Compliance Review
                    </h2>
                    <p className="text-purple-200/80 text-sm">
                      {reviewingDocument.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Download DPR Button */}
                    <button
                      onClick={() => {
                        // Use the new download API endpoint
                        window.open(`http://localhost:8000/api/download/${encodeURIComponent(reviewingDocument.name)}`, '_blank');
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download DPR
                    </button>
                    <button
                      onClick={() => setReviewModalOpen(false)}
                      className="text-white/60 hover:text-white transition-colors"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>

              {/* Modal Content */}
              <div className="p-6 space-y-6">
                {reviewLoading ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-white/60 text-sm">Analyzing compliance and feasibility...</p>
                  </div>
                ) : reviewData ? (
                  <>
                    {/* Non-Compliance Warning (Not Auto-Rejection) */}
                    {reviewData.compliance_data && !reviewData.compliance_data.compliant && (
                      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <svg className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <div>
                            <h3 className="text-yellow-300 font-semibold mb-1">MDoNER Guidelines Not Met</h3>
                            <p className="text-yellow-200/80 text-sm mb-2">
                              This DPR does not meet some mandatory MDoNER guidelines. Please review the violations below and make a decision.
                            </p>
                            <p className="text-yellow-200/60 text-xs italic">
                              As admin, you can still approve this DPR if you find the violations acceptable or reject it for resubmission.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Compliance Success Message */}
                    {reviewData.compliance_data && reviewData.compliance_data.compliant && (
                      <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                        <div className="flex items-start gap-3">
                          <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <h3 className="text-green-300 font-semibold mb-1">MDoNER Guidelines Met</h3>
                            <p className="text-green-200/80 text-sm">
                              This DPR meets all mandatory MDoNER guidelines. You can proceed with approval or request additional revisions.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Compliance Check Results */}
                    {reviewData.compliance_data && (
                      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-xl font-semibold text-white">Compliance Check</h3>
                          <div className={`px-4 py-2 rounded-lg font-semibold ${
                            reviewData.compliance_data.compliant 
                              ? 'bg-green-500/20 text-green-300' 
                              : 'bg-red-500/20 text-red-300'
                          }`}>
                            {reviewData.compliance_data.compliant ? '✓ COMPLIANT' : '✗ NON-COMPLIANT'}
                          </div>
                        </div>

                        {/* Compliance Score */}
                        <div className="mb-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-white/80 text-sm">Compliance Score</span>
                            <span className="text-white font-semibold">{reviewData.compliance_data.compliance_score}%</span>
                          </div>
                          <div className="w-full bg-white/10 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${
                                reviewData.compliance_data.compliance_score >= 80 ? 'bg-green-500' :
                                reviewData.compliance_data.compliance_score >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${reviewData.compliance_data.compliance_score}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Critical Violations */}
                        {reviewData.compliance_data.critical_violations && reviewData.compliance_data.critical_violations.length > 0 && (
                          <div className="mb-4">
                            <h4 className="text-red-300 font-semibold mb-2">Critical Violations</h4>
                            <ul className="space-y-2">
                              {reviewData.compliance_data.critical_violations.map((violation: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2 text-red-200/80 text-sm">
                                  <span className="text-red-400 mt-1">•</span>
                                  <span>{violation}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Missing Sections */}
                        {reviewData.compliance_data.missing_sections && reviewData.compliance_data.missing_sections.length > 0 && (
                          <div>
                            <h4 className="text-yellow-300 font-semibold mb-2">Missing Required Sections</h4>
                            <ul className="space-y-2">
                              {reviewData.compliance_data.missing_sections.map((section: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-2 text-yellow-200/80 text-sm">
                                  <span className="text-yellow-400 mt-1">•</span>
                                  <span>{section}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Rejection Reason */}
                        {reviewData.compliance_data.rejection_reason && (
                          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <h4 className="text-red-300 font-semibold mb-2">Rejection Reason</h4>
                            <p className="text-red-200/80 text-sm">{reviewData.compliance_data.rejection_reason}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Detailed Recommendation Assessment */}
                    {recommendationData && (
                      <div className="space-y-5 mt-6">
                        <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-purple-600/20 border border-purple-500/40 rounded-xl p-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-purple-600/30 rounded-xl flex items-center justify-center">
                              <svg className="w-7 h-7 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <h3 className="text-purple-200 font-bold text-xl mb-1">AI-Powered Feasibility Assessment</h3>
                              <p className="text-purple-200/70 text-sm">
                                Comprehensive analysis across three critical dimensions to guide your approval decision
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Technical Feasibility BAR */}
                        {recommendationData.assessment?.technical && (
                          <div className="bg-gradient-to-br from-blue-900/40 via-blue-800/30 to-blue-900/40 border-2 border-blue-500/50 rounded-xl p-6 shadow-lg">
                            {/* Bar Header */}
                            <div className="flex items-center justify-between mb-5 pb-4 border-b border-blue-400/30">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold text-blue-200">1. Technical Feasibility</h3>
                                  <p className="text-blue-300/80 text-sm mt-1">Engineering design, site suitability & construction methodology</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-3">
                                <span className={`px-4 py-2 rounded-lg text-base font-bold shadow-md ${
                                  recommendationData.assessment.technical.rating === 'EXCELLENT' ? 'bg-green-500/30 text-green-200 border border-green-400/50' :
                                  recommendationData.assessment.technical.rating === 'GOOD' ? 'bg-blue-500/30 text-blue-200 border border-blue-400/50' :
                                  recommendationData.assessment.technical.rating === 'ADEQUATE' ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50' :
                                  'bg-red-500/30 text-red-200 border border-red-400/50'
                                }`}>
                                  {recommendationData.assessment.technical.rating}
                                </span>
                                <span className="text-white font-bold text-2xl">{recommendationData.assessment.technical.score}<span className="text-white/60 text-lg">/100</span></span>
                                <button
                                  onClick={() => approveSection(reviewingDocument.id, 'technical')}
                                  disabled={sectionApprovals[reviewingDocument.id]?.technical === 'approved'}
                                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-bold border-2 transition-all shadow-lg ${
                                    sectionApprovals[reviewingDocument.id]?.technical === 'approved'
                                      ? 'bg-green-600/40 text-green-100 border-green-400/60 cursor-not-allowed'
                                      : 'bg-blue-600/50 text-white border-blue-400/60 hover:bg-blue-600/70 hover:scale-105'
                                  }`}
                                >
                                  {sectionApprovals[reviewingDocument.id]?.technical === 'approved' ? (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Approved
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Approve
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Score Progress Bar */}
                            <div className="mb-5">
                              <div className="w-full bg-blue-950/50 rounded-full h-4 shadow-inner border border-blue-500/30">
                                <div 
                                  className={`h-4 rounded-full transition-all duration-500 ${
                                    recommendationData.assessment.technical.score >= 80 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                    recommendationData.assessment.technical.score >= 60 ? 'bg-gradient-to-r from-blue-500 to-blue-400' :
                                    recommendationData.assessment.technical.score >= 40 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                    'bg-gradient-to-r from-red-500 to-red-400'
                                  }`}
                                  style={{ width: `${recommendationData.assessment.technical.score}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Detailed Analysis */}
                            <div className="bg-blue-950/40 rounded-lg p-4 mb-5 border border-blue-400/20">
                              <h4 className="text-blue-200 font-semibold mb-2 text-sm uppercase tracking-wide">Assessment</h4>
                              <p className="text-white/90 text-sm leading-relaxed">
                                {recommendationData.assessment.technical.detailed_analysis}
                              </p>
                            </div>

                            {/* Strengths and Concerns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-4">
                                <h4 className="text-green-300 font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Strengths
                                </h4>
                                <ul className="space-y-2">
                                  {recommendationData.assessment.technical.strengths.map((strength: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                                      <span className="text-green-400 font-bold mt-1">✓</span>
                                      <span>{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="bg-orange-950/30 border border-orange-500/30 rounded-lg p-4">
                                <h4 className="text-orange-300 font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  Areas for Improvement
                                </h4>
                                <ul className="space-y-2">
                                  {recommendationData.assessment.technical.concerns.map((concern: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                                      <span className="text-orange-400 font-bold mt-1">⚠</span>
                                      <span>{concern}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Financial Feasibility BAR */}
                        {recommendationData.assessment?.financial && (
                          <div className="bg-gradient-to-br from-emerald-900/40 via-emerald-800/30 to-emerald-900/40 border-2 border-emerald-500/50 rounded-xl p-6 shadow-lg">
                            {/* Bar Header */}
                            <div className="flex items-center justify-between mb-5 pb-4 border-b border-emerald-400/30">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-emerald-600 to-emerald-700 rounded-xl flex items-center justify-center shadow-lg">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold text-emerald-200">2. Financial Feasibility</h3>
                                  <p className="text-emerald-300/80 text-sm mt-1">Budget realism, economic viability & funding mechanism</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-3">
                                <span className={`px-4 py-2 rounded-lg text-base font-bold shadow-md ${
                                  recommendationData.assessment.financial.rating === 'EXCELLENT' ? 'bg-green-500/30 text-green-200 border border-green-400/50' :
                                  recommendationData.assessment.financial.rating === 'GOOD' ? 'bg-blue-500/30 text-blue-200 border border-blue-400/50' :
                                  recommendationData.assessment.financial.rating === 'ADEQUATE' ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50' :
                                  'bg-red-500/30 text-red-200 border border-red-400/50'
                                }`}>
                                  {recommendationData.assessment.financial.rating}
                                </span>
                                <span className="text-white font-bold text-2xl">{recommendationData.assessment.financial.score}<span className="text-white/60 text-lg">/100</span></span>
                                <button
                                  onClick={() => approveSection(reviewingDocument.id, 'financial')}
                                  disabled={sectionApprovals[reviewingDocument.id]?.financial === 'approved'}
                                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-bold border-2 transition-all shadow-lg ${
                                    sectionApprovals[reviewingDocument.id]?.financial === 'approved'
                                      ? 'bg-green-600/40 text-green-100 border-green-400/60 cursor-not-allowed'
                                      : 'bg-emerald-600/50 text-white border-emerald-400/60 hover:bg-emerald-600/70 hover:scale-105'
                                  }`}
                                >
                                  {sectionApprovals[reviewingDocument.id]?.financial === 'approved' ? (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Approved
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Approve
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Score Progress Bar */}
                            <div className="mb-5">
                              <div className="w-full bg-emerald-950/50 rounded-full h-4 shadow-inner border border-emerald-500/30">
                                <div 
                                  className={`h-4 rounded-full transition-all duration-500 ${
                                    recommendationData.assessment.financial.score >= 80 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                    recommendationData.assessment.financial.score >= 60 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                                    recommendationData.assessment.financial.score >= 40 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                    'bg-gradient-to-r from-red-500 to-red-400'
                                  }`}
                                  style={{ width: `${recommendationData.assessment.financial.score}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Detailed Analysis */}
                            <div className="bg-emerald-950/40 rounded-lg p-4 mb-5 border border-emerald-400/20">
                              <h4 className="text-emerald-200 font-semibold mb-2 text-sm uppercase tracking-wide">Assessment</h4>
                              <p className="text-white/90 text-sm leading-relaxed">
                                {recommendationData.assessment.financial.detailed_analysis}
                              </p>
                            </div>

                            {/* Strengths and Concerns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-4">
                                <h4 className="text-green-300 font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Strengths
                                </h4>
                                <ul className="space-y-2">
                                  {recommendationData.assessment.financial.strengths.map((strength: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                                      <span className="text-green-400 font-bold mt-1">✓</span>
                                      <span>{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="bg-orange-950/30 border border-orange-500/30 rounded-lg p-4">
                                <h4 className="text-orange-300 font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  Budget Concerns
                                </h4>
                                <ul className="space-y-2">
                                  {recommendationData.assessment.financial.concerns.map((concern: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                                      <span className="text-orange-400 font-bold mt-1">⚠</span>
                                      <span>{concern}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Risk Assessment BAR */}
                        {recommendationData.assessment?.risk && (
                          <div className="bg-gradient-to-br from-orange-900/40 via-orange-800/30 to-orange-900/40 border-2 border-orange-500/50 rounded-xl p-6 shadow-lg">
                            {/* Bar Header */}
                            <div className="flex items-center justify-between mb-5 pb-4 border-b border-orange-400/30">
                              <div className="flex items-center gap-4">
                                <div className="w-14 h-14 bg-gradient-to-br from-orange-600 to-orange-700 rounded-xl flex items-center justify-center shadow-lg">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-2xl font-bold text-orange-200">3. Risk Assessment</h3>
                                  <p className="text-orange-300/80 text-sm mt-1">Risk identification, mitigation strategies & contingency planning</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-3">
                                <span className={`px-4 py-2 rounded-lg text-base font-bold shadow-md ${
                                  recommendationData.assessment.risk.rating === 'EXCELLENT' ? 'bg-green-500/30 text-green-200 border border-green-400/50' :
                                  recommendationData.assessment.risk.rating === 'GOOD' ? 'bg-blue-500/30 text-blue-200 border border-blue-400/50' :
                                  recommendationData.assessment.risk.rating === 'ADEQUATE' ? 'bg-yellow-500/30 text-yellow-200 border border-yellow-400/50' :
                                  'bg-red-500/30 text-red-200 border border-red-400/50'
                                }`}>
                                  {recommendationData.assessment.risk.rating}
                                </span>
                                <span className="text-white font-bold text-2xl">{recommendationData.assessment.risk.score}<span className="text-white/60 text-lg">/100</span></span>
                                <button
                                  onClick={() => approveSection(reviewingDocument.id, 'risk')}
                                  disabled={sectionApprovals[reviewingDocument.id]?.risk === 'approved'}
                                  className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-base font-bold border-2 transition-all shadow-lg ${
                                    sectionApprovals[reviewingDocument.id]?.risk === 'approved'
                                      ? 'bg-green-600/40 text-green-100 border-green-400/60 cursor-not-allowed'
                                      : 'bg-orange-600/50 text-white border-orange-400/60 hover:bg-orange-600/70 hover:scale-105'
                                  }`}
                                >
                                  {sectionApprovals[reviewingDocument.id]?.risk === 'approved' ? (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      Approved
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                      </svg>
                                      Approve
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {/* Score Progress Bar */}
                            <div className="mb-5">
                              <div className="w-full bg-orange-950/50 rounded-full h-4 shadow-inner border border-orange-500/30">
                                <div 
                                  className={`h-4 rounded-full transition-all duration-500 ${
                                    recommendationData.assessment.risk.score >= 80 ? 'bg-gradient-to-r from-green-500 to-green-400' :
                                    recommendationData.assessment.risk.score >= 60 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                    recommendationData.assessment.risk.score >= 40 ? 'bg-gradient-to-r from-orange-500 to-orange-400' :
                                    'bg-gradient-to-r from-red-500 to-red-400'
                                  }`}
                                  style={{ width: `${recommendationData.assessment.risk.score}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Detailed Analysis */}
                            <div className="bg-orange-950/40 rounded-lg p-4 mb-5 border border-orange-400/20">
                              <h4 className="text-orange-200 font-semibold mb-2 text-sm uppercase tracking-wide">Assessment</h4>
                              <p className="text-white/90 text-sm leading-relaxed">
                                {recommendationData.assessment.risk.detailed_analysis}
                              </p>
                            </div>

                            {/* Strengths and Concerns */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="bg-green-950/30 border border-green-500/30 rounded-lg p-4">
                                <h4 className="text-green-300 font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  Risk Management Strengths
                                </h4>
                                <ul className="space-y-2">
                                  {recommendationData.assessment.risk.strengths.map((strength: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                                      <span className="text-green-400 font-bold mt-1">✓</span>
                                      <span>{strength}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-4">
                                <h4 className="text-red-300 font-bold mb-3 text-sm uppercase tracking-wide flex items-center gap-2">
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                  </svg>
                                  Risk Concerns
                                </h4>
                                <ul className="space-y-2">
                                  {recommendationData.assessment.risk.concerns.map((concern: string, idx: number) => (
                                    <li key={idx} className="flex items-start gap-2 text-white/80 text-sm">
                                      <span className="text-red-400 font-bold mt-1">⚠</span>
                                      <span>{concern}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Overall Recommendation - Final Summary */}
                        {recommendationData.recommendation && (
                          <div className={`border-2 rounded-xl p-7 shadow-xl ${
                            recommendationData.recommendation.action === 'APPROVE' ? 'bg-gradient-to-br from-green-900/50 via-green-800/40 to-green-900/50 border-green-400/60' :
                            recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'bg-gradient-to-br from-yellow-900/50 via-yellow-800/40 to-yellow-900/50 border-yellow-400/60' :
                            'bg-gradient-to-br from-orange-900/50 via-orange-800/40 to-orange-900/50 border-orange-400/60'
                          }`}>
                            <div className="flex items-center justify-between mb-6 pb-5 border-b ${
                              recommendationData.recommendation.action === 'APPROVE' ? 'border-green-400/30' :
                              recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'border-yellow-400/30' :
                              'border-orange-400/30'
                            }">
                              <div className="flex items-center gap-4">
                                <div className={`w-16 h-16 rounded-xl flex items-center justify-center shadow-lg ${
                                  recommendationData.recommendation.action === 'APPROVE' ? 'bg-gradient-to-br from-green-600 to-green-700' :
                                  recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'bg-gradient-to-br from-yellow-600 to-yellow-700' :
                                  'bg-gradient-to-br from-orange-600 to-orange-700'
                                }`}>
                                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                </div>
                                <div>
                                  <h3 className="text-3xl font-bold text-white mb-1">Overall Recommendation</h3>
                                  <p className="text-white/70 text-sm">Final decision guidance based on comprehensive analysis</p>
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-3">
                                <span className={`px-6 py-3 rounded-xl font-bold text-base shadow-lg border-2 ${
                                  recommendationData.recommendation.action === 'APPROVE' ? 'bg-green-500/40 text-green-100 border-green-300/60' :
                                  recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'bg-yellow-500/40 text-yellow-100 border-yellow-300/60' :
                                  'bg-orange-500/40 text-orange-100 border-orange-300/60'
                                }`}>
                                  {recommendationData.recommendation.action.replace('_', ' ')}
                                </span>
                                <div className="text-right">
                                  <div className="text-white/60 text-xs uppercase tracking-wide mb-1">Confidence Level</div>
                                  <div className="text-white font-bold text-xl">
                                    {recommendationData.recommendation.confidence}%
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Overall Score Progress */}
                            <div className="mb-6">
                              <div className="flex justify-between items-center mb-3">
                                <span className="text-white font-semibold text-base">Overall Feasibility Score</span>
                                <span className="text-white font-bold text-3xl">{recommendationData.recommendation.overall_score}<span className="text-white/60 text-xl">/100</span></span>
                              </div>
                              <div className={`w-full rounded-full h-5 shadow-inner border-2 ${
                                recommendationData.recommendation.action === 'APPROVE' ? 'bg-green-950/50 border-green-500/40' :
                                recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'bg-yellow-950/50 border-yellow-500/40' :
                                'bg-orange-950/50 border-orange-500/40'
                              }`}>
                                <div 
                                  className={`h-full rounded-full transition-all duration-1000 shadow-lg ${
                                    recommendationData.recommendation.overall_score >= 80 ? 'bg-gradient-to-r from-green-500 via-green-400 to-green-500' :
                                    recommendationData.recommendation.overall_score >= 60 ? 'bg-gradient-to-r from-yellow-500 via-yellow-400 to-yellow-500' : 
                                    'bg-gradient-to-r from-orange-500 via-orange-400 to-orange-500'
                                  }`}
                                  style={{ width: `${recommendationData.recommendation.overall_score}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Summary */}
                            <div className={`rounded-lg p-5 border ${
                              recommendationData.recommendation.action === 'APPROVE' ? 'bg-green-950/40 border-green-400/30' :
                              recommendationData.recommendation.action === 'CONDITIONAL_APPROVE' ? 'bg-yellow-950/40 border-yellow-400/30' :
                              'bg-orange-950/40 border-orange-400/30'
                            }`}>
                              <h4 className="text-white font-bold mb-3 text-base uppercase tracking-wide">Executive Summary</h4>
                              <p className="text-white/90 text-base leading-relaxed">
                                {recommendationData.recommendation.summary}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action Buttons - Show Recommendation button first, then Approve/Reject */}
                    <div className="flex justify-between items-center gap-3 pt-4 border-t border-white/10">
                      <button
                        onClick={() => setReviewModalOpen(false)}
                        className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      
                      <div className="flex gap-3">
                        {!recommendationData ? (
                          <button
                            onClick={handleGetRecommendation}
                            disabled={recommendationLoading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {recommendationLoading ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                Analyzing...
                              </>
                            ) : (
                              <>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                Get Recommendation
                              </>
                            )}
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={async () => {
                                const rejectionReason = reviewData.compliance_data?.rejection_reason || 
                                  'Document does not meet MDoNER guidelines and requires revisions.';
                                
                                await updateDocumentStatus(
                                  reviewingDocument.id,
                                  'rejected',
                                  rejectionReason,
                                  { name: 'MDoNER Admin', email: 'mdoner.admin@gov.in' }
                                );
                                
                                // Refresh documents
                                const submitted = await getSubmittedDocuments();
                                setSubmittedDocuments(submitted);
                                setReviewModalOpen(false);
                              }}
                              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              Reject
                            </button>
                            <button
                              onClick={async () => {
                                await updateDocumentStatus(
                                  reviewingDocument.id,
                                  'approved',
                                  'Document has been reviewed and approved by MDoNER Admin.',
                                  { name: 'MDoNER Admin', email: 'mdoner.admin@gov.in' }
                                );
                                
                                // Refresh documents
                                const submitted = await getSubmittedDocuments();
                                setSubmittedDocuments(submitted);
                                setReviewModalOpen(false);
                              }}
                              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Approve
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-white/60">No review data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

interface ClientDashboardProps {
  sectionApprovals: Record<string, {
    technical?: 'approved' | 'rejected' | null;
    financial?: 'approved' | 'rejected' | null;
    risk?: 'approved' | 'rejected' | null;
  }>;
}

const ClientDashboard: React.FC<ClientDashboardProps> = ({ sectionApprovals }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null); // Track which document's recommendations are expanded
  const { addDocument, getClientDocuments, updateDocumentStatus } = useDocuments();
  
  // Get current user's documents and sort by date (newest first)
  const user = auth.getUser();
  const uploadedDocuments = user 
    ? getClientDocuments(user.email).sort((a, b) => {
        const dateA = new Date(a.uploadDate).getTime();
        const dateB = new Date(b.uploadDate).getTime();
        return dateB - dateA; // Descending order (newest first)
      })
    : [];

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
      
      // Upload to backend API (Fast recommendations-only endpoint)
      const response = await fetch('http://localhost:8000/api/upload-dpr-fast', {
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

  const handleViewAnalysis = (document: UploadedDocument) => {
    // Toggle expand/collapse of recommendations
    if (expandedDocId === document.id) {
      setExpandedDocId(null); // Collapse if already expanded
    } else {
      setExpandedDocId(document.id); // Expand this document
    }
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
              <div className="flex items-center gap-3 mb-3">
                <svg className="w-6 h-6 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <h2 className="text-xl font-bold">Recommendations to Improve Your DPR</h2>
              </div>
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

  const handleExportRecommendationsTXT = (document: UploadedDocument) => {
    if (document.analysisData?.actionable_insights) {
      const recommendations = document.analysisData.actionable_insights.filter(
        (insight: string) => !insight.startsWith('ASSESSMENT -')
      );

      // Create formatted text report for recommendations only
      let reportText = `
================================================================================
                    DPR RECOMMENDATIONS REPORT
================================================================================

Document: ${document.name}
Upload Date: ${new Date(document.uploadDate).toLocaleDateString()}
Report Generated: ${new Date().toLocaleString()}
Total Recommendations: ${recommendations.length}

================================================================================
                        ACTIONABLE RECOMMENDATIONS
================================================================================

`;

      recommendations.forEach((insight: string, index: number) => {
        // Extract priority, category, and content
        const priorityMatch = insight.match(/PRIORITY (\d+)/);
        const priority = priorityMatch ? priorityMatch[1] : (index + 1).toString();
        
        const categoryMatch = insight.match(/\[([^\]]+)\]/);
        const category = categoryMatch ? categoryMatch[1] : 'GENERAL';
        
        let cleanInsight = insight
          .replace(/^PRIORITY \d+ - /, '')
          .replace(/\[[^\]]+\]\s*/, '');
        
        // Split into action and explanation
        let action = cleanInsight;
        let explanation = '';
        if (cleanInsight.includes(' - ')) {
          const dashIndex = cleanInsight.indexOf(' - ');
          action = cleanInsight.substring(0, dashIndex).trim();
          explanation = cleanInsight.substring(dashIndex + 3).trim();
        }

        reportText += `
RECOMMENDATION ${index + 1}
${'-'.repeat(80)}
Priority:    ${priority}
Category:    ${category}

Action Required:
${action}

Why This Matters:
${explanation}

`;
      });

      reportText += `
================================================================================
                              END OF REPORT
================================================================================

Generated by: AI-Powered DPR Assessment System
Ministry of Development of North Eastern Region (MDoNER)
`;

      // Create blob and download
      const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = window.document.createElement('a');
      a.href = url;
      a.download = `DPR_Recommendations_${document.name.replace(/\.[^/.]+$/, '')}_${new Date().toISOString().split('T')[0]}.txt`;
      window.document.body.appendChild(a);
      a.click();
      window.document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleExportRecommendationsPDF = async (document: UploadedDocument) => {
    if (!document.analysisData?.actionable_insights) {
      alert('No recommendations available to export');
      return;
    }

    try {
      // Dynamic import of jsPDF
      const { jsPDF } = await import('jspdf');
      
      // Extract project info from the correct path (extracted_data from fast endpoint)
      const extractedData = document.analysisData.extracted_data || {};
      const projectInfo = {
        name: extractedData.project_title || 'N/A',
        location: extractedData.location || 'N/A',
        estimated_cost: extractedData.budget?.total_formatted || 'N/A',
        duration: extractedData.timeline?.duration || 'N/A'
      };
      
      const recommendations = document.analysisData.actionable_insights.filter(
        (insight: string) => !insight.startsWith('ASSESSMENT -')
      );

      // Create new PDF document (A4 size)
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Set margins and page dimensions
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 15;
      const contentWidth = pageWidth - (2 * margin);
      let yPosition = margin;

      // Helper function to add new page if needed
      const checkPageBreak = (requiredHeight: number) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Helper function to wrap text
      const wrapText = (text: string, maxWidth: number, fontSize: number) => {
        doc.setFontSize(fontSize);
        const lines = doc.splitTextToSize(text, maxWidth);
        return lines;
      };

      // Header with colored background
      doc.setFillColor(102, 126, 234);
      doc.rect(0, 0, pageWidth, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('DPR RECOMMENDATIONS REPORT', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(document.name, pageWidth / 2, 22, { align: 'center' });
      
      yPosition = 40;

      // Project Information Section
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Project Information', margin, yPosition);
      yPosition += 7;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      const infoItems = [
        { label: 'Project Name:', value: projectInfo.name || 'N/A' },
        { label: 'Location:', value: projectInfo.location || 'N/A' },
        { label: 'Cost:', value: projectInfo.estimated_cost || 'N/A' },
        { label: 'Duration:', value: projectInfo.duration || 'N/A' },
        { label: 'Analyzed:', value: new Date().toLocaleDateString() }
      ];

      infoItems.forEach(item => {
        checkPageBreak(7);
        doc.setFont('helvetica', 'bold');
        doc.text(item.label, margin, yPosition);
        doc.setFont('helvetica', 'normal');
        const valueLines = wrapText(item.value, contentWidth - 40, 9);
        valueLines.forEach((line: string, idx: number) => {
          if (idx > 0) {
            yPosition += 5;
            checkPageBreak(5);
          }
          doc.text(line, margin + 40, yPosition);
        });
        yPosition += 6;
      });

      yPosition += 5;

      // Recommendations Section Header
      checkPageBreak(15);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Priority Recommendations', margin, yPosition);
      yPosition += 8;

      // Process each recommendation
      recommendations.forEach((rec: string, index: number) => {
        const separatorIndex = rec.indexOf(' - ');
        let category = '';
        let priority = '';
        let action = '';
        let explanation = '';

        if (separatorIndex !== -1) {
          const prefix = rec.substring(0, separatorIndex);
          const content = rec.substring(separatorIndex + 3);
          
          const prefixParts = prefix.split(' | ');
          if (prefixParts.length >= 2) {
            category = prefixParts[0].replace('Category: ', '').trim();
            priority = prefixParts[1].replace('Priority: ', '').trim();
          }

          const whySeparator = content.indexOf('💡 Why this matters:');
          if (whySeparator !== -1) {
            action = content.substring(0, whySeparator).trim();
            explanation = content.substring(whySeparator + 20).trim();
          } else {
            action = content.trim();
          }
        }

        // Recommendation header with number
        checkPageBreak(20);
        doc.setFillColor(247, 250, 252);
        doc.rect(margin, yPosition - 2, contentWidth, 8, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(102, 126, 234);
        doc.text(`Recommendation ${index + 1}`, margin + 2, yPosition + 3);
        yPosition += 10;

        // Category and Priority badges
        if (category || priority) {
          checkPageBreak(8);
          doc.setFontSize(8);
          let xPos = margin;
          
          if (category) {
            doc.setFillColor(219, 234, 254);
            doc.setTextColor(30, 64, 175);
            const catWidth = doc.getTextWidth(category) + 6;
            doc.roundedRect(xPos, yPosition - 3, catWidth, 5, 1, 1, 'F');
            doc.text(category, xPos + 3, yPosition);
            xPos += catWidth + 3;
          }

          if (priority) {
            let fillColor: [number, number, number] = [254, 226, 226];
            let textColor: [number, number, number] = [153, 27, 27];
            
            if (priority.toLowerCase().includes('high')) {
              fillColor = [254, 226, 226]; textColor = [153, 27, 27];
            } else if (priority.toLowerCase().includes('medium')) {
              fillColor = [254, 243, 199]; textColor = [146, 64, 14];
            } else if (priority.toLowerCase().includes('low')) {
              fillColor = [254, 249, 195]; textColor = [113, 63, 18];
            } else {
              fillColor = [219, 234, 254]; textColor = [30, 64, 175];
            }

            doc.setFillColor(...fillColor);
            doc.setTextColor(...textColor);
            const priWidth = doc.getTextWidth(priority) + 6;
            doc.roundedRect(xPos, yPosition - 3, priWidth, 5, 1, 1, 'F');
            doc.text(priority, xPos + 3, yPosition);
          }
          
          yPosition += 8;
        }

        // Action text (bold)
        if (action) {
          checkPageBreak(15);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(0, 0, 0);
          const actionLines = wrapText(action, contentWidth - 4, 9);
          actionLines.forEach((line: string) => {
            checkPageBreak(5);
            doc.text(line, margin + 2, yPosition);
            yPosition += 5;
          });
        }

        // Explanation with icon
        if (explanation) {
          yPosition += 2;
          checkPageBreak(15);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.setTextColor(75, 85, 99);
          doc.text('ℹ Why this matters:', margin + 2, yPosition);
          yPosition += 5;
          
          doc.setFont('helvetica', 'normal');
          const explLines = wrapText(explanation, contentWidth - 8, 8);
          explLines.forEach((line: string) => {
            checkPageBreak(4);
            doc.text(line, margin + 6, yPosition);
            yPosition += 4;
          });
        }

        yPosition += 8;
      });

      // Footer on all pages
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(128, 128, 128);
        doc.text(
          `Generated by DPR Analysis System - Page ${i} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      // Download the PDF file
      const fileName = `DPR_Recommendations_${document.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);

    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
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
        bg: 'bg-red-900/60', 
        text: 'text-red-200', 
        border: 'border-red-400/50',
        icon: '⚠️',
        label: 'Rejected - Requires Revision'
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
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handleSubmitToAdmin(document)}
                        disabled={!document.analysisData || document.status === 'submitted'}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                          document.status === 'submitted'
                            ? 'bg-green-600 text-white cursor-not-allowed shadow-lg'
                            : document.analysisData 
                              ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-lg hover:shadow-amber-600/50' 
                              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        {document.status === 'submitted' ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        )}
                        {document.status === 'submitted' ? 'Submitted' : 'Submit to Admin'}
                      </button>
                      {getStatusBadge(document.status)}
                    </div>
                  </div>

                  {document.reviewerComments && (
                    <div className={`border rounded-lg p-4 mt-3 ${
                      document.status === 'rejected' 
                        ? 'bg-red-900/20 border-red-500/40' 
                        : 'bg-black/20 border-white/10'
                    }`}>
                      <div className="flex items-start gap-3">
                        {document.status === 'rejected' && (
                          <div className="flex-shrink-0 mt-0.5">
                            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1">
                          <p className={`text-xs font-medium mb-2 ${
                            document.status === 'rejected' ? 'text-red-300' : 'text-gray-400'
                          }`}>
                            {document.status === 'rejected' ? 'Document Rejected - Action Required:' : 'Reviewer Comments:'}
                          </p>
                          <p className={`text-sm leading-relaxed ${
                            document.status === 'rejected' ? 'text-red-100' : 'text-gray-300'
                          }`}>
                            {document.reviewerComments}
                          </p>
                          {document.status === 'rejected' && (
                            <div className="mt-3 p-3 bg-red-800/30 border border-red-600/30 rounded-md">
                              <p className="text-xs text-red-200 font-medium mb-1">Next Steps:</p>
                              <ul className="text-xs text-red-200 space-y-1">
                                <li>• Review the feedback provided above</li>
                                <li>• Make necessary corrections to your DPR document</li>
                                <li>• Upload the revised document for re-evaluation</li>
                                <li>• Contact support if you need clarification on the requirements</li>
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Section Approval Progress */}
                  {document.status === 'submitted' && sectionApprovals[document.id] && (
                    <div className="bg-gradient-to-r from-black/20 to-black/10 border border-white/10 rounded-lg p-4 mt-3">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <span className="text-white text-sm font-medium">Review Progress</span>
                      </div>
                      <div className="space-y-2">
                        {/* Technical Feasibility */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-blue-500/20 rounded">
                              <svg className="w-3 h-3 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                            </div>
                            <span className="text-gray-300 text-xs">Technical Feasibility</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {sectionApprovals[document.id]?.technical === 'approved' ? (
                              <div className="flex items-center gap-1 bg-green-600/20 text-green-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approved
                              </div>
                            ) : sectionApprovals[document.id]?.technical === 'rejected' ? (
                              <div className="flex items-center gap-1 bg-red-600/20 text-red-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Rejected
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-amber-600/20 text-amber-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Under Review
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Financial Feasibility */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-emerald-500/20 rounded">
                              <svg className="w-3 h-3 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                              </svg>
                            </div>
                            <span className="text-gray-300 text-xs">Financial Feasibility</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {sectionApprovals[document.id]?.financial === 'approved' ? (
                              <div className="flex items-center gap-1 bg-green-600/20 text-green-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approved
                              </div>
                            ) : sectionApprovals[document.id]?.financial === 'rejected' ? (
                              <div className="flex items-center gap-1 bg-red-600/20 text-red-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Rejected
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-amber-600/20 text-amber-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Under Review
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Risk Assessment */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="p-1 bg-orange-500/20 rounded">
                              <svg className="w-3 h-3 text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.99-.833-2.732 0L4.08 16.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                            <span className="text-gray-300 text-xs">Risk Assessment</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {sectionApprovals[document.id]?.risk === 'approved' ? (
                              <div className="flex items-center gap-1 bg-green-600/20 text-green-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approved
                              </div>
                            ) : sectionApprovals[document.id]?.risk === 'rejected' ? (
                              <div className="flex items-center gap-1 bg-red-600/20 text-red-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Rejected
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 bg-amber-600/20 text-amber-300 px-2 py-1 rounded text-xs">
                                <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Under Review
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                    <button 
                      onClick={() => handleViewAnalysis(document)}
                      disabled={!document.analysisData}
                      className={`text-xs font-medium transition-colors flex items-center gap-1 ${
                        document.analysisData 
                          ? 'text-blue-300 hover:text-blue-400 cursor-pointer' 
                          : 'text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {expandedDocId === document.id ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        )}
                      </svg>
                      {expandedDocId === document.id ? 'Hide Analysis' : 'View Analysis'}
                    </button>
                    <div className="text-xs text-gray-500">
                      ID: {document.id}
                    </div>
                  </div>

                  {/* Expandable Recommendations Section */}
                  {expandedDocId === document.id && document.analysisData?.actionable_insights && (
                    <div className="mt-4 pt-4 border-t border-white/10 transition-all duration-300 ease-in-out">
                      <div className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 rounded-xl p-5 backdrop-blur-sm border border-white/10">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-white">AI-Powered Recommendations</h3>
                            <p className="text-xs text-gray-400">Actionable improvements to strengthen your DPR for MDoNER approval</p>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {document.analysisData.actionable_insights
                            .filter((insight: string) => !insight.startsWith('ASSESSMENT -'))
                            .map((insight: string, idx: number) => {
                              // Extract priority, category, and content
                              const priorityMatch = insight.match(/PRIORITY (\d+)/);
                              const priority = priorityMatch ? parseInt(priorityMatch[1]) : idx + 1;
                              
                              const categoryMatch = insight.match(/\[([^\]]+)\]/);
                              const category = categoryMatch ? categoryMatch[1] : 'GENERAL';
                              
                              let cleanInsight = insight
                                .replace(/^PRIORITY \d+ - /, '')
                                .replace(/\[[^\]]+\]\s*/, '');
                              
                              // Split into action and explanation if " - " exists
                              let action = cleanInsight;
                              let explanation = '';
                              if (cleanInsight.includes(' - ')) {
                                const dashIndex = cleanInsight.indexOf(' - ');
                                action = cleanInsight.substring(0, dashIndex).trim();
                                explanation = cleanInsight.substring(dashIndex + 3).trim();
                              }
                              
                              // Priority color coding
                              const priorityColors: {[key: number]: {bg: string, border: string, badge: string, text: string}} = {
                                1: {bg: 'bg-red-900/30', border: 'border-red-500', badge: 'bg-red-500/20 text-red-300', text: 'text-red-300'},
                                2: {bg: 'bg-orange-900/30', border: 'border-orange-500', badge: 'bg-orange-500/20 text-orange-300', text: 'text-orange-300'},
                                3: {bg: 'bg-yellow-900/30', border: 'border-yellow-500', badge: 'bg-yellow-500/20 text-yellow-300', text: 'text-yellow-300'},
                              };
                              const colorScheme = priorityColors[priority] || {
                                bg: 'bg-blue-900/30', 
                                border: 'border-blue-500', 
                                badge: 'bg-blue-500/20 text-blue-300',
                                text: 'text-blue-300'
                              };
                              
                              return (
                                <div key={idx} className={`${colorScheme.bg} border-l-4 ${colorScheme.border} rounded-r-lg p-4`}>
                                  <div className="flex items-start gap-3">
                                    <div className={`w-8 h-8 ${colorScheme.bg} rounded-full flex items-center justify-center font-bold text-sm border-2 ${colorScheme.border}`}>
                                      {priority}
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${colorScheme.badge}`}>
                                          {category}
                                        </span>
                                        <span className={`text-xs font-bold ${colorScheme.text}`}>
                                          PRIORITY {priority}
                                        </span>
                                      </div>
                                      <p className="text-sm text-white font-medium mb-2">{action}</p>
                                      {explanation && (
                                        <div className="bg-black/30 rounded-lg p-3 border-l-2 border-indigo-400">
                                          <div className="flex items-start gap-2">
                                            <svg className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                            </svg>
                                            <div className="flex-1">
                                              <p className="text-xs font-semibold text-indigo-300 mb-1">Why this matters:</p>
                                              <p className="text-xs text-indigo-200 leading-relaxed">{explanation}</p>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                        </div>

                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
                          <p className="text-xs text-gray-400">
                            <span className="font-semibold text-white">{document.analysisData.actionable_insights.filter((i: string) => !i.startsWith('ASSESSMENT')).length}</span> recommendations identified
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleExportRecommendationsTXT(document)}
                              className="text-xs text-green-400 hover:text-green-300 transition-colors flex items-center gap-1 px-3 py-1.5 bg-green-900/20 rounded-lg hover:bg-green-900/30"
                              title="Export as TXT"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                              </svg>
                              TXT
                            </button>
                            <button
                              onClick={() => handleExportRecommendationsPDF(document)}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 px-3 py-1.5 bg-red-900/20 rounded-lg hover:bg-red-900/30"
                              title="Export as PDF"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                              </svg>
                              PDF
                            </button>
                            <button
                              onClick={() => setExpandedDocId(null)}
                              className="text-xs text-gray-400 hover:text-white transition-colors flex items-center gap-1"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                              </svg>
                              Collapse
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
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