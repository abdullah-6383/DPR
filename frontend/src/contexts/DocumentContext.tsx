'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  uploadDate: string;
  status: 'viewed' | 'under-review' | 'approved' | 'rejected' | 'pending' | 'submitted';
  reviewerComments?: string;
  uploadedBy: {
    name: string;
    email: string;
    department: string;
  };
  reviewedBy?: {
    name: string;
    email: string;
  };
  reviewDate?: string;
  analysisData?: any; // Store backend analysis results
  lastUpdated?: string;
}

interface DocumentContextType {
  documents: UploadedDocument[];
  loading: boolean;
  addDocument: (document: Omit<UploadedDocument, 'id'>) => Promise<void>;
  updateDocumentStatus: (id: string, status: UploadedDocument['status'], comments?: string, reviewedBy?: { name: string; email: string }) => Promise<void>;
  getClientDocuments: (clientEmail: string) => UploadedDocument[];
  getAllDocuments: () => UploadedDocument[];
  refreshDocuments: () => Promise<void>;
  getSubmittedDocuments: () => Promise<UploadedDocument[]>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
};

const BACKEND_URL = 'http://localhost:8000';

// Mock data fallback
const getMockDocuments = (): UploadedDocument[] => [
  {
    id: '1',
    name: 'Project_DPR_Northeast_Development.pdf',
    size: 2340000,
    uploadDate: '2025-10-08',
    status: 'approved',
    reviewerComments: 'All requirements met. Project approved for implementation.',
    uploadedBy: {
      name: 'Project Client',
      email: 'client.user@project.in',
      department: 'Project Stakeholder'
    },
    reviewedBy: {
      name: 'MDoNER Admin',
      email: 'mdoner.admin@gov.in'
    },
    reviewDate: '2025-10-09'
  },
  {
    id: '2',
    name: 'Infrastructure_Assessment_Report.docx',
    size: 1560000,
    uploadDate: '2025-10-09',
    status: 'under-review',
    reviewerComments: 'Currently being reviewed by technical team.',
    uploadedBy: {
      name: 'Project Client',
      email: 'client.user@project.in',
      department: 'Project Stakeholder'
    }
  },
  {
    id: '3',
    name: 'Environmental_Impact_Study.pdf',
    size: 3200000,
    uploadDate: '2025-10-10',
    status: 'viewed',
    reviewerComments: 'Document has been received and is in queue for review.',
    uploadedBy: {
      name: 'Project Client',
      email: 'client.user@project.in',
      department: 'Project Stakeholder'
    }
  }
];

export const DocumentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [loading, setLoading] = useState(true);

  // Load documents from backend on mount
  useEffect(() => {
    refreshDocuments();
  }, []);

  const refreshDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/documents/list`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      } else {
        console.error('Failed to load documents');
        // Fallback to mock data if backend is not available
        setDocuments(getMockDocuments());
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      // Fallback to mock data if backend is not available
      setDocuments(getMockDocuments());
    } finally {
      setLoading(false);
    }
  };

  const addDocument = async (document: Omit<UploadedDocument, 'id'>) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/documents/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(document),
      });

      if (response.ok) {
        const data = await response.json();
        setDocuments(prev => [...prev, data.document]);
      } else {
        console.error('Failed to add document to backend');
        // Fallback to local state
        const newDocument = {
          ...document,
          id: Date.now().toString(),
          uploadDate: document.uploadDate || new Date().toISOString().split('T')[0],
        };
        setDocuments(prev => [...prev, newDocument]);
      }
    } catch (error) {
      console.error('Error adding document:', error);
      // Fallback to local state
      const newDocument = {
        ...document,
        id: Date.now().toString(),
        uploadDate: document.uploadDate || new Date().toISOString().split('T')[0],
      };
      setDocuments(prev => [...prev, newDocument]);
    }
  };

  const updateDocumentStatus = async (
    id: string, 
    status: UploadedDocument['status'], 
    comments?: string, 
    reviewedBy?: { name: string; email: string }
  ) => {
    try {
      const updateData = {
        status,
        ...(comments && { reviewerComments: comments }),
        ...(reviewedBy && { reviewedBy }),
      };

      const response = await fetch(`${BACKEND_URL}/api/documents/${id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        // Update local state
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === id 
              ? { 
                  ...doc, 
                  status, 
                  ...(comments && { reviewerComments: comments }),
                  ...(reviewedBy && { reviewedBy }),
                  lastUpdated: new Date().toISOString()
                }
              : doc
          )
        );
      } else {
        console.error('Failed to update document status in backend');
        // Fallback to local state update
        setDocuments(prev => 
          prev.map(doc => 
            doc.id === id 
              ? { 
                  ...doc, 
                  status, 
                  ...(comments && { reviewerComments: comments }),
                  ...(reviewedBy && { reviewedBy }),
                  lastUpdated: new Date().toISOString()
                }
              : doc
          )
        );
      }
    } catch (error) {
      console.error('Error updating document status:', error);
      // Fallback to local state update
      setDocuments(prev => 
        prev.map(doc => 
          doc.id === id 
            ? { 
                ...doc, 
                status, 
                ...(comments && { reviewerComments: comments }),
                ...(reviewedBy && { reviewedBy }),
                lastUpdated: new Date().toISOString()
              }
            : doc
        )
      );
    }
  };

  const getSubmittedDocuments = async (): Promise<UploadedDocument[]> => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/documents/submitted`);
      if (response.ok) {
        const data = await response.json();
        return data.documents || [];
      }
    } catch (error) {
      console.error('Error fetching submitted documents:', error);
    }
    // Fallback to local filter
    return documents.filter(doc => doc.status === 'submitted');
  };

  const getClientDocuments = (clientEmail: string): UploadedDocument[] => {
    return documents.filter(doc => doc.uploadedBy.email === clientEmail);
  };

  const getAllDocuments = (): UploadedDocument[] => {
    return documents;
  };

  return (
    <DocumentContext.Provider value={{
      documents,
      loading,
      addDocument,
      updateDocumentStatus,
      getClientDocuments,
      getAllDocuments,
      refreshDocuments,
      getSubmittedDocuments
    }}>
      {children}
    </DocumentContext.Provider>
  );
};