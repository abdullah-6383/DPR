# Implementation Plan for Remaining Features

## [TARGET] Missing Features Implementation Guide

This document provides detailed implementation steps for the 4 features that are not yet fully implemented:

1. Collaboration Tools
2. DPR Version Control
3. Past DPR Comparison
4. Explainable AI (Enhancement)

---

## 1. 🤝 Collaboration Tools

### Overview
Enable team members to collaborate on DPR reviews through comments, mentions, and real-time discussions.

### Database Schema

```sql
-- Comments Table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dpr_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    section VARCHAR(100), -- e.g., 'budget_analysis', 'risk_assessment'
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'resolved', 'archived'
    parent_id UUID, -- For threaded replies
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES comments(id)
);

-- Mentions Table
CREATE TABLE mentions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL,
    mentioned_user_email VARCHAR(255) NOT NULL,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

-- Notifications Table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    type VARCHAR(50), -- 'mention', 'reply', 'status_change'
    content TEXT,
    link VARCHAR(500),
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Backend API Endpoints

```python
# Add to simple_app.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import List, Dict
import uuid
from datetime import datetime

# WebSocket connection manager for real-time updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, dpr_id: str):
        await websocket.accept()
        if dpr_id not in self.active_connections:
            self.active_connections[dpr_id] = []
        self.active_connections[dpr_id].append(websocket)

    def disconnect(self, websocket: WebSocket, dpr_id: str):
        self.active_connections[dpr_id].remove(websocket)

    async def broadcast(self, message: dict, dpr_id: str):
        if dpr_id in self.active_connections:
            for connection in self.active_connections[dpr_id]:
                await connection.send_json(message)

manager = ConnectionManager()

# Comment endpoints
@app.post("/api/comments")
async def add_comment(
    dpr_id: str,
    section: str,
    content: str,
    user_email: str,
    user_name: str,
    parent_id: str = None
):
    """Add a comment to a DPR section"""
    comment_id = str(uuid.uuid4())
    comment_data = {
        "id": comment_id,
        "dpr_id": dpr_id,
        "section": section,
        "content": content,
        "user_email": user_email,
        "user_name": user_name,
        "parent_id": parent_id,
        "status": "open",
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    # Save to database (implement your DB logic)
    # db.comments.insert_one(comment_data)
    
    # Check for mentions (@username)
    mentions = extract_mentions(content)
    for mention in mentions:
        # Create notification
        notify_user(mention, comment_id, user_name, dpr_id)
    
    # Broadcast to WebSocket clients
    await manager.broadcast({
        "type": "new_comment",
        "data": comment_data
    }, dpr_id)
    
    return {"status": "success", "comment": comment_data}

@app.get("/api/comments/{dpr_id}")
async def get_comments(dpr_id: str, section: str = None):
    """Get all comments for a DPR or specific section"""
    # query = {"dpr_id": dpr_id}
    # if section:
    #     query["section"] = section
    # comments = db.comments.find(query).sort("created_at", -1)
    # return list(comments)
    pass

@app.put("/api/comments/{comment_id}")
async def update_comment(comment_id: str, content: str):
    """Update comment content"""
    # db.comments.update_one(
    #     {"id": comment_id},
    #     {"$set": {"content": content, "updated_at": datetime.now()}}
    # )
    pass

@app.delete("/api/comments/{comment_id}")
async def delete_comment(comment_id: str):
    """Delete a comment"""
    # db.comments.delete_one({"id": comment_id})
    pass

@app.post("/api/comments/{comment_id}/resolve")
async def resolve_comment(comment_id: str, user_email: str):
    """Mark comment as resolved"""
    # db.comments.update_one(
    #     {"id": comment_id},
    #     {"$set": {"status": "resolved", "resolved_by": user_email}}
    # )
    pass

# WebSocket endpoint for real-time updates
@app.websocket("/ws/{dpr_id}")
async def websocket_endpoint(websocket: WebSocket, dpr_id: str):
    await manager.connect(websocket, dpr_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming messages
            await manager.broadcast({"message": data}, dpr_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, dpr_id)

def extract_mentions(text: str) -> List[str]:
    """Extract @mentions from text"""
    import re
    pattern = r'@(\w+(?:\.\w+)*@\w+(?:\.\w+)+)'
    return re.findall(pattern, text)

def notify_user(user_email: str, comment_id: str, from_user: str, dpr_id: str):
    """Create notification for mentioned user"""
    notification = {
        "id": str(uuid.uuid4()),
        "user_email": user_email,
        "type": "mention",
        "content": f"{from_user} mentioned you in a comment",
        "link": f"/portal/dpr/{dpr_id}#comment-{comment_id}",
        "read": False,
        "created_at": datetime.now().isoformat()
    }
    # Save to database
    # db.notifications.insert_one(notification)
```

### Frontend Components

```typescript
// Create: src/components/CommentSection.tsx

import React, { useState, useEffect } from 'react';

interface Comment {
  id: string;
  content: string;
  user_name: string;
  user_email: string;
  created_at: string;
  status: string;
  replies?: Comment[];
}

export const CommentSection: React.FC<{ dprId: string; section: string }> = ({ dprId, section }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Load existing comments
    fetchComments();
    
    // Connect to WebSocket for real-time updates
    const websocket = new WebSocket(`ws://localhost:8000/ws/${dprId}`);
    websocket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_comment') {
        setComments(prev => [data.data, ...prev]);
      }
    };
    setWs(websocket);
    
    return () => websocket.close();
  }, [dprId]);

  const fetchComments = async () => {
    const response = await fetch(`http://localhost:8000/api/comments/${dprId}?section=${section}`);
    const data = await response.json();
    setComments(data);
  };

  const handleSubmit = async () => {
    const response = await fetch('http://localhost:8000/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dpr_id: dprId,
        section: section,
        content: newComment,
        user_email: 'current.user@example.com',
        user_name: 'Current User'
      })
    });
    
    if (response.ok) {
      setNewComment('');
    }
  };

  return (
    <div className="comment-section">
      <h3>Comments</h3>
      
      {/* Add comment */}
      <div className="add-comment">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment... Use @ to mention someone"
        />
        <button onClick={handleSubmit}>Post Comment</button>
      </div>
      
      {/* Display comments */}
      <div className="comments-list">
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
    </div>
  );
};

const CommentItem: React.FC<{ comment: Comment }> = ({ comment }) => (
  <div className="comment-item">
    <div className="comment-header">
      <strong>{comment.user_name}</strong>
      <span>{new Date(comment.created_at).toLocaleString()}</span>
    </div>
    <div className="comment-content">{comment.content}</div>
    <div className="comment-actions">
      <button>Reply</button>
      <button>Resolve</button>
    </div>
  </div>
);
```

---

## 2. [EDIT] DPR Version Control

### Overview
Track changes to DPRs over time, allowing users to see version history and compare versions.

### Database Schema

```sql
CREATE TABLE dpr_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dpr_id VARCHAR(255) NOT NULL,
    version_number INTEGER NOT NULL,
    file_path VARCHAR(500),
    file_name VARCHAR(255),
    file_size BIGINT,
    analysis_data JSONB,
    changes_summary TEXT,
    created_by_email VARCHAR(255),
    created_by_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dpr_id, version_number)
);

CREATE TABLE version_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version_id UUID NOT NULL,
    section VARCHAR(100),
    change_type VARCHAR(50), -- 'added', 'modified', 'deleted'
    old_value TEXT,
    new_value TEXT,
    FOREIGN KEY (version_id) REFERENCES dpr_versions(id) ON DELETE CASCADE
);
```

### Backend Implementation

```python
# Add to simple_app.py

@app.post("/api/dpr/{dpr_id}/versions")
async def create_version(
    dpr_id: str,
    file: UploadFile,
    user_email: str,
    user_name: str,
    changes_summary: str = ""
):
    """Create a new version of a DPR"""
    # Get current version number
    # latest_version = db.dpr_versions.find_one(
    #     {"dpr_id": dpr_id},
    #     sort=[("version_number", -1)]
    # )
    # new_version_number = (latest_version["version_number"] + 1) if latest_version else 1
    
    new_version_number = 1  # Placeholder
    
    # Save file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_path = f"uploads/versions/{dpr_id}_v{new_version_number}_{timestamp}.pdf"
    
    # Process and analyze new version
    extracted_text = extract_text(file_path, file.filename.split('.')[-1])
    structured_dpr = structure_dpr_data(extracted_text)
    analysis = await analyze_dpr_with_gemini(extracted_text, structured_dpr)
    
    # Compare with previous version
    if new_version_number > 1:
        changes = compare_versions(dpr_id, new_version_number - 1, analysis)
    else:
        changes = []
    
    version_data = {
        "id": str(uuid.uuid4()),
        "dpr_id": dpr_id,
        "version_number": new_version_number,
        "file_path": file_path,
        "file_name": file.filename,
        "file_size": file.size,
        "analysis_data": analysis,
        "changes_summary": changes_summary,
        "created_by_email": user_email,
        "created_by_name": user_name,
        "created_at": datetime.now().isoformat()
    }
    
    # Save to database
    # db.dpr_versions.insert_one(version_data)
    
    return {
        "status": "success",
        "version": version_data,
        "changes": changes
    }

@app.get("/api/dpr/{dpr_id}/versions")
async def get_versions(dpr_id: str):
    """Get all versions of a DPR"""
    # versions = db.dpr_versions.find({"dpr_id": dpr_id}).sort("version_number", -1)
    # return list(versions)
    pass

@app.get("/api/dpr/{dpr_id}/versions/{version_number}")
async def get_version(dpr_id: str, version_number: int):
    """Get a specific version"""
    # version = db.dpr_versions.find_one({
    #     "dpr_id": dpr_id,
    #     "version_number": version_number
    # })
    # return version
    pass

@app.post("/api/dpr/{dpr_id}/versions/{version_number}/restore")
async def restore_version(dpr_id: str, version_number: int, user_email: str):
    """Restore a previous version"""
    # Get the version to restore
    # old_version = db.dpr_versions.find_one({
    #     "dpr_id": dpr_id,
    #     "version_number": version_number
    # })
    
    # Create a new version with the old data
    # new_version_number = get_next_version_number(dpr_id)
    
    # Save as new version
    pass

def compare_versions(dpr_id: str, old_version: int, new_analysis: dict) -> List[dict]:
    """Compare two versions and return changes"""
    # old_data = db.dpr_versions.find_one({
    #     "dpr_id": dpr_id,
    #     "version_number": old_version
    # })
    
    changes = []
    
    # Compare budget
    # if new_analysis['budget'] != old_data['analysis_data']['budget']:
    #     changes.append({
    #         "section": "budget",
    #         "type": "modified",
    #         "old_value": old_data['analysis_data']['budget'],
    #         "new_value": new_analysis['budget']
    #     })
    
    return changes
```

### Frontend Component

```typescript
// Create: src/components/VersionHistory.tsx

export const VersionHistory: React.FC<{ dprId: string }> = ({ dprId }) => {
  const [versions, setVersions] = useState([]);
  const [selectedVersions, setSelectedVersions] = useState<[number, number]>([1, 2]);

  useEffect(() => {
    fetchVersions();
  }, [dprId]);

  const fetchVersions = async () => {
    const response = await fetch(`http://localhost:8000/api/dpr/${dprId}/versions`);
    const data = await response.json();
    setVersions(data);
  };

  const compareVersions = async () => {
    // Fetch and compare selected versions
  };

  const restoreVersion = async (versionNumber: number) => {
    if (confirm(`Restore version ${versionNumber}? This will create a new version.`)) {
      await fetch(`http://localhost:8000/api/dpr/${dprId}/versions/${versionNumber}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_email: 'current.user@example.com' })
      });
      fetchVersions();
    }
  };

  return (
    <div className="version-history">
      <h3>Version History</h3>
      
      <div className="versions-timeline">
        {versions.map(version => (
          <div key={version.id} className="version-item">
            <div className="version-number">v{version.version_number}</div>
            <div className="version-info">
              <strong>{version.file_name}</strong>
              <p>{version.created_by_name}</p>
              <p>{new Date(version.created_at).toLocaleString()}</p>
              <p>{version.changes_summary}</p>
            </div>
            <div className="version-actions">
              <button onClick={() => restoreVersion(version.version_number)}>
                Restore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 3. [CHART] Past DPR Comparison

### Overview
Compare current DPR with historical DPRs to identify trends and best practices.

### Backend Implementation

```python
@app.post("/api/compare")
async def compare_dprs(dpr_ids: List[str]):
    """Compare multiple DPRs"""
    # Fetch all DPRs
    dprs = []
    for dpr_id in dpr_ids:
        # dpr = db.analysis_results.find_one({"dpr_id": dpr_id})
        # dprs.append(dpr)
        pass
    
    # Compare key metrics
    comparison = {
        "budget_comparison": compare_budgets(dprs),
        "timeline_comparison": compare_timelines(dprs),
        "risk_comparison": compare_risks(dprs),
        "score_comparison": compare_scores(dprs)
    }
    
    return comparison

@app.get("/api/dpr/{dpr_id}/similar")
async def find_similar_dprs(dpr_id: str, limit: int = 5):
    """Find similar DPRs based on project type, budget, location"""
    # current_dpr = db.analysis_results.find_one({"dpr_id": dpr_id})
    
    # Use similarity algorithm
    # similar_dprs = find_by_similarity(current_dpr, limit)
    
    pass

@app.get("/api/analytics/trends")
async def get_trends(project_type: str = None, date_from: str = None, date_to: str = None):
    """Get trend analysis across DPRs"""
    # query = {}
    # if project_type:
    #     query["project_type"] = project_type
    # if date_from and date_to:
    #     query["upload_time"] = {"$gte": date_from, "$lte": date_to}
    
    # dprs = db.analysis_results.find(query)
    
    trends = {
        "average_score": calculate_average_score(),
        "approval_rate": calculate_approval_rate(),
        "common_issues": identify_common_issues(),
        "success_factors": identify_success_factors()
    }
    
    return trends
```

---

## 4. 🧠 Explainable AI (Enhancement)

### Overview
Add confidence scores, decision reasoning, and factor importance to make AI predictions more transparent.

### Implementation

```python
def generate_ai_explanation(analysis: dict, structured_dpr: dict) -> dict:
    """Generate detailed explanation of AI decision"""
    
    explanation = {
        "confidence_scores": {
            "overall": calculate_confidence(analysis['overall_score']),
            "budget": calculate_section_confidence(analysis['budget_validation']),
            "timeline": calculate_section_confidence(analysis['timeline_validation']),
            "technical": calculate_section_confidence(analysis['technical_feasibility']),
            "risk": calculate_section_confidence(analysis['risk_assessment'])
        },
        "decision_factors": {
            "positive_factors": extract_positive_factors(analysis),
            "negative_factors": extract_negative_factors(analysis),
            "neutral_factors": extract_neutral_factors(analysis)
        },
        "factor_importance": rank_factors(analysis),
        "alternative_scenarios": generate_scenarios(analysis, structured_dpr),
        "why_this_recommendation": explain_recommendation(analysis)
    }
    
    return explanation

def calculate_confidence(score: int) -> float:
    """Calculate confidence level (0-1) based on data completeness and consistency"""
    # Implement confidence calculation logic
    pass

def explain_recommendation(analysis: dict) -> str:
    """Generate human-readable explanation of recommendation"""
    decision = analysis['approval_recommendation']['decision']
    
    if decision == "APPROVE":
        return f"""
        This DPR is recommended for approval because:
        1. Budget validation passed with {analysis['budget_validation'].get('score', 0)}% confidence
        2. Timeline is realistic with {analysis['timeline_validation'].get('score', 0)}% feasibility
        3. Technical specifications meet {analysis['technical_feasibility'].get('score', 0)}% of requirements
        4. Risk level is manageable at {analysis['risk_assessment'].get('overall_risk_level', 'unknown')}
        5. Compliance check passed with {len(analysis['compliance_check'].get('guideline_gaps', []))} minor gaps
        """
    # Similar for REVISE and REJECT
    pass
```

---

## [PACKAGE] Required NPM Packages

```bash
# Frontend
npm install socket.io-client  # For WebSocket
npm install diff-match-patch  # For version comparison
npm install recharts  # For analytics charts
npm install @heroicons/react  # For icons

# Backend (Python)
pip install websockets  # For WebSocket support
pip install sqlalchemy  # For database ORM
pip install alembic  # For database migrations
pip install redis  # For caching
pip install celery  # For background jobs
```

---

## 🗓️ Implementation Timeline

### Week 1-2: Explainable AI
- Add confidence scoring
- Implement decision reasoning
- Create factor importance ranking
- Build explanation generator

### Week 3-5: Collaboration Tools
- Set up database schema
- Build comment API
- Implement WebSocket real-time updates
- Create frontend components
- Add @mention functionality
- Build notification system

### Week 6-7: Version Control
- Design version storage
- Implement version tracking API
- Build version history UI
- Create comparison algorithm
- Add restore functionality

### Week 8-9: Comparison Tools
- Build comparison API
- Implement similarity algorithm
- Create comparison UI
- Add trend analysis
- Build analytics dashboard

---

## [TARGET] Success Criteria

Each feature should meet these criteria:
- [CHECK] Fully functional API endpoints
- [CHECK] Complete frontend UI
- [CHECK] Unit tests (80%+ coverage)
- [CHECK] Integration tests
- [CHECK] Documentation
- [CHECK] User acceptance testing

---

**Next Action**: Choose which feature to implement first based on priority!
