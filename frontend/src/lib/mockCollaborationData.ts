// Mock data for collaboration features

export interface DPRDocument {
  id: string;
  title: string;
  status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  assignedTo?: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  content: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'officer' | 'client';
  department: string;
}

export interface Review {
  id: string;
  dprId: string;
  reviewerId: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  dprId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface ActivityTimelineItem {
  id: string;
  dprId: string;
  action: string;
  userId: string;
  timestamp: string;
  details?: string;
}

// Mock DPR documents
export const mockDPRDocuments: DPRDocument[] = [
  {
    id: '1',
    title: 'Bridge Construction Project - Phase 1',
    status: 'under_review',
    assignedTo: ['user2', 'user3'],
    createdBy: 'user1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-16T14:30:00Z',
    content: 'Daily Progress Report for bridge construction project...'
  },
  {
    id: '2',
    title: 'Road Maintenance Project',
    status: 'approved',
    assignedTo: ['user2'],
    createdBy: 'user4',
    createdAt: '2024-01-14T09:00:00Z',
    updatedAt: '2024-01-15T16:00:00Z',
    content: 'Progress report on road maintenance activities...'
  },
  {
    id: '3',
    title: 'Infrastructure Assessment',
    status: 'draft',
    createdBy: 'user1',
    createdAt: '2024-01-16T11:00:00Z',
    updatedAt: '2024-01-16T11:00:00Z',
    content: 'Assessment of current infrastructure conditions...'
  }
];

// Mock users
export const mockUsers: User[] = [
  {
    id: 'user1',
    name: 'John Smith',
    email: 'john.smith@gov.in',
    role: 'client',
    department: 'Engineering'
  },
  {
    id: 'user2',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@gov.in',
    role: 'officer',
    department: 'Review Board'
  },
  {
    id: 'user3',
    name: 'Mike Davis',
    email: 'mike.davis@gov.in',
    role: 'officer',
    department: 'Quality Assurance'
  },
  {
    id: 'user4',
    name: 'Lisa Chen',
    email: 'lisa.chen@gov.in',
    role: 'admin',
    department: 'Administration'
  }
];

// Mock reviews
const mockReviews: Review[] = [
  {
    id: 'review1',
    dprId: '1',
    reviewerId: 'user2',
    rating: 4,
    comment: 'Good progress on the bridge construction. Minor improvements needed in documentation.',
    createdAt: '2024-01-16T10:30:00Z'
  },
  {
    id: 'review2',
    dprId: '2',
    reviewerId: 'user3',
    rating: 5,
    comment: 'Excellent work on road maintenance. All safety protocols followed.',
    createdAt: '2024-01-15T15:00:00Z'
  }
];

// Mock comments
const mockComments: Comment[] = [
  {
    id: 'comment1',
    dprId: '1',
    authorId: 'user2',
    content: 'Please provide more details on the concrete quality tests.',
    createdAt: '2024-01-16T09:15:00Z'
  },
  {
    id: 'comment2',
    dprId: '1',
    authorId: 'user1',
    content: 'Will update with detailed test results by end of day.',
    createdAt: '2024-01-16T11:45:00Z'
  }
];

// Mock activity timeline
export const mockActivityTimeline: ActivityTimelineItem[] = [
  {
    id: 'activity1',
    dprId: '1',
    action: 'Document submitted for review',
    userId: 'user1',
    timestamp: '2024-01-15T10:00:00Z'
  },
  {
    id: 'activity2',
    dprId: '1',
    action: 'Assigned to reviewer',
    userId: 'user4',
    timestamp: '2024-01-15T10:30:00Z',
    details: 'Assigned to Sarah Johnson'
  },
  {
    id: 'activity3',
    dprId: '2',
    action: 'Review completed',
    userId: 'user3',
    timestamp: '2024-01-15T15:00:00Z'
  },
  {
    id: 'activity4',
    dprId: '2',
    action: 'Document approved',
    userId: 'user4',
    timestamp: '2024-01-15T16:00:00Z'
  }
];

// Helper functions
export const getReviewsByDPRId = (dprId: string): Review[] => {
  return mockReviews.filter(review => review.dprId === dprId);
};

export const getCommentsByDPRId = (dprId: string): Comment[] => {
  return mockComments.filter(comment => comment.dprId === dprId);
};

export const getUserById = (userId: string): User | undefined => {
  return mockUsers.find(user => user.id === userId);
};

export const getDPRById = (dprId: string): DPRDocument | undefined => {
  return mockDPRDocuments.find(dpr => dpr.id === dprId);
};