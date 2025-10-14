# Quick Start Guide - DPR Analysis System

## [ROCKET] Start the Application

### Step 1: Start Backend
```powershell
cd backend
python simple_app.py
```
[CHECK] Backend running on `http://localhost:8000`

### Step 2: Start Frontend (New Terminal)
```powershell
cd frontend
npm run dev
```
[CHECK] Frontend running on `http://localhost:3000`

## [EDIT] Test the System

### Login as Client User
1. Go to `http://localhost:3000/login`
2. Enter credentials:
   - **Email**: `client.user@project.in`
   - **Password**: `client123`

### Upload & Analyze Document
1. Click the file upload area
2. Select a PDF or DOCX file
3. Click "Upload & Analyze Document"
4. Wait for AI processing (30-60 seconds)
5. Document appears in list with analysis

### View & Download Report
- **[CHART] View Report** - Opens formatted report in new window
- **[DOCUMENT] Download TXT** - Downloads as text file
- **[PACKAGE] Download JSON** - Downloads complete data

## [TARGET] Key Features Working

[CHECK] Real-time file upload
[CHECK] AI-powered DPR analysis  
[CHECK] Structured JSON output (no formatting lines)
[CHECK] HTML report viewer
[CHECK] TXT file export
[CHECK] JSON data export
[CHECK] Document tracking
[CHECK] Status updates

## [CHART] What Gets Analyzed

The AI analyzes:
- Budget validation
- Timeline feasibility
- Technical specifications
- Risk assessment (financial, timeline, environmental, resource)
- Compliance with MDoNER guidelines
- Overall recommendations

## [SEARCH] Check Analysis Results

Backend saves analysis to:
```
backend/analysis_results/analysis_TIMESTAMP_FILENAME.json
```

Frontend displays in UI with 3 export options!

---

**Status**: [CHECK] FULLY INTEGRATED AND WORKING
