# Implementation Plan - Meeting & Task Tracker Refactor

Refactor the application from an AI transcript analyzer into a clean, robust Meeting and Task Tracker supporting manual meeting logging, task management, and a secure external automation ingestion API.

## Proposed Changes

### 1. Data Model & Types (`src/types.ts`)
- Update `Meeting`: Remove `transcript`, `summary`, `fullAnalysis`, `analysisStatus`, `errorMessage`, `modelName`. Add `notes: string | null`.
- Update `Task`: Remove `confirmationStatus`, `needsReview`, `reviewReasons`, `evidenceExcerpt`, `source`. Tasks have `status: 'pending' | 'in_progress' | 'completed'`.
- Update `DashboardStats`: Remove `waitingReviewCount`.

### 2. Database & Storage (`server/db.ts`)
- Update database schema records for meetings and tasks.
- Add support for finding or creating meetings by user email and title for external integrations.
- Implement duplicate-task checking (`description` + `meetingId`) for the external integration endpoint.

### 3. External Task Ingestion API (`server.ts`)
- Remove all Gemini SDK imports, analyzer functions, and `/api/meetings/:id/analyze` routes.
- Add `POST /api/integrations/tasks`:
  - Verify `x-api-key` header against `process.env.INTEGRATION_API_KEY` (fallback to `"m2a_integration_secret_2026"` if unset).
  - Look up user by `user_email`.
  - Find or create meeting by `meeting_title` and `user_id`.
  - Ingest tasks, skipping duplicates (same meeting and description).

### 4. Backend Meeting & Task Routes (`server.ts`)
- Update meeting creation & update endpoints for title, date, participants, and notes.
- Update task endpoints for standard CRUD (pending, in_progress, completed).

### 5. Frontend Pages & Components
- **New Meeting Page (`src/pages/NewMeetingPage.tsx`)**: Title, date, participants tag input, optional notes textarea. Rename button to "Save Meeting". Remove transcript, file upload, sample button, character counter, and AI analyze button.
- **Meeting Detail Page (`src/pages/AnalysisPage.tsx` -> `MeetingDetailPage.tsx`)**: Replaces AI Analysis page. Shows title, date, participants, notes, linked tasks list, edit meeting modal, add task modal, and delete meeting with confirmation.
- **Task Manager Page (`src/pages/TaskManagerPage.tsx`)**: Shows all tasks. Remove confirmation badges, review flags, and evidence. Support pending, in progress, completed statuses, search, and filters.
- **Meeting History Page (`src/pages/MeetingHistoryPage.tsx`)**: Table showing title, date, participants, total tasks count, and completed tasks count. Search and delete with confirmation.
- **Dashboard Page (`src/pages/DashboardPage.tsx`)**: Remove review attention banner. Keep total meetings, total tasks, pending, completed, overdue, upcoming deadlines, and recent meetings.
- **API Client (`src/services/api.ts`)**: Update methods for meetings and tasks.

## Verification Plan
1. Run `compile_applet` and `lint_applet` to verify zero TypeScript errors.
2. Test registration, meeting creation, task management, and meeting history via API and UI.
3. Test `POST /api/integrations/tasks` with `x-api-key` header to ensure external automation tasks are ingested successfully without duplicates.
