# Engineering Blueprint: LOFT AI Workspace Assistant Integration (OpenClaw)

> **V1 decision:** Keep the AI architecture simple for the presentation prototype: **OpenClaw + GPT-5.6 + LOFT backend tools**.

## 1. Project Objective

LOFT needs an embedded AI Workspace Assistant that lets users naturally speak or type requests and have LOFT help them understand and operate their work across the independent teams they belong to.

The V1 assistant should demonstrate:

- Natural-language conversation
- Task creation and supported task updates
- Meeting creation and supported meeting changes
- Message drafting and, if implemented, controlled message sending
- Summaries of workspace content
- Cross-team agenda/workload queries
- Auto-Reprioritization using LOFT's deterministic Smart Priority engine
- Optional voice interaction if time permits

The assistant is an interaction layer over LOFT, not a separate chatbot or replacement for the normal UI.

## 2. V1 Technology Decision

### Core stack

- **Agent harness:** OpenClaw
- **V1 reasoning model:** GPT-5.6
- **Application:** LOFT web application
- **Backend:** LOFT server/API
- **Database:** Supabase Postgres with RLS
- **Validation:** Zod
- **Optional semantic retrieval:** PostgreSQL `pgvector`
- **Voice:** Optional for V1; use a compatible realtime speech layer without replacing the main GPT-5.6 reasoning flow

### Deliberately excluded from V1

Do not add these to the critical path:

- Multiple LLM providers
- Model routing
- Multiple specialist agents
- Self-learning agents
- Autonomous background agents
- Custom model training
- Complex retrieval pipelines unless actually needed

DeepSeek, Gemini, Claude, and other providers may be evaluated later after the V1 workflow is stable.

## 3. V1 Architecture

```text
User
  |
  v
LOFT AI Assistant UI
  |
  v
OpenClaw
Agent orchestration / tool selection
  |
  v
GPT-5.6
Natural-language reasoning
  |
  +-----------------------------+
  |                             |
  v                             v
Approved LOFT Tools       Smart Priority Engine
  |                             |
  +-------------+---------------+
                |
                v
          LOFT Server/API
                |
                v
       Supabase Postgres + RLS
```

### Responsibility boundaries

**GPT-5.6**

- Understand natural-language requests
- Determine intent
- Extract structured arguments
- Decide which approved tool is relevant
- Summarize retrieved content
- Explain Smart Priority results
- Produce concise natural-language responses

**OpenClaw**

- Agent/session orchestration
- Tool selection and execution flow
- Conversation handling
- Streaming agent responses

**LOFT backend**

- Authentication
- Authorization
- Database queries and writes
- Input validation
- Team membership checks
- RLS enforcement
- Notifications
- Actual task/meeting/message changes

**Smart Priority engine**

- Deterministic task scoring
- Priority ranking
- Recalculation when task factors change

The LLM must never be the authority for permissions or raw database operations.

## 4. Natural-Language Interaction

Users should not need special command syntax.

Examples:

> "What's on my schedule today?"

> "Add a task to finish the presentation tomorrow."

> "Move the development meeting to 3 PM."

> "Tell the team the meeting starts at 3."

> "Summarize what we discussed about the database."

> "What should I work on first?"

> "Reprioritize my tasks."

The assistant translates these into structured operations while the backend handles the actual work.

## 5. Approved V1 Tools

Keep the tool surface intentionally small.

### `get_my_agenda`

Returns the signed-in user's permitted tasks and meetings for a requested date/range.

```json
{
  "target_date_iso": "YYYY-MM-DD",
  "scope": "single_team | all_teams"
}
```

The server determines the authenticated user and only returns data that user is allowed to see.

### `create_task`

```json
{
  "team_id": "string",
  "title": "string",
  "description": "string|null",
  "assignee_id": "string|null",
  "due_date": "YYYY-MM-DD|null",
  "urgency": "low|normal|high|urgent"
}
```

### `update_task`

V1 supports only explicitly approved fields such as title, deadline, urgency, status, or assignee.

### `create_meeting`

```json
{
  "team_id": "string",
  "title": "string",
  "start_iso": "ISO-8601 timestamp",
  "duration_minutes": "number",
  "attendee_group": "team | selected_members"
}
```

### `update_meeting`

Supports safe changes such as moving a meeting or changing its duration/title.

### `search_workspace_content`

Searches only content the authenticated user is permitted to access.

V1 should prefer normal database queries for structured information. `pgvector` is optional and should only be introduced when it materially improves the demo.

### `summarize_content`

Summarizes content already retrieved and authorized by LOFT.

### `draft_message`

Creates a message draft. Sending is a separate validated operation.

### `send_message` — optional V1

If implemented, recipient and team permissions must be verified server-side.

## 6. Token and Cost Efficiency

The user should be able to use simple wording without causing large model requests.

### Required optimisation rules

1. **Retrieve only relevant data.**
2. Do not send the entire workspace to GPT-5.6.
3. Do not send all chat history for every request.
4. Keep the system prompt concise.
5. Use structured tool arguments.
6. Keep tool results minimal.
7. Limit conversation history and use a compact summary when needed.
8. Calculate deterministic values in LOFT instead of asking the model to calculate them.
9. Keep successful assistant responses concise.
10. Resolve relative dates using the server-generated current timestamp.

Example:

```text
User:
"What's due tomorrow?"

        |
        v

LOFT backend queries only tomorrow's permitted tasks
        |
        v

GPT-5.6 receives only the relevant records
        |
        v

"Tomorrow you have three tasks: ..."
```

Do not send hundreds of unrelated tasks, meetings, and messages to answer one simple question.

## 7. Auto-Reprioritization

Auto-Reprioritization must not depend entirely on GPT-5.6.

```text
User:
"Reprioritize my tasks."
        |
        v
LOFT retrieves active tasks
        |
        v
Smart Priority engine
        |
        +-- deadline urgency
        +-- user/task urgency
        +-- overdue status
        +-- dependency/blocking impact
        +-- status
        +-- estimated effort/workload where available
        |
        v
New ranking
        |
        v
GPT-5.6 explains the result
        |
        v
My Plan updates
```

GPT-5.6 should explain actual calculated results rather than inventing a ranking.

Example:

> "I moved API testing to #1 because it is due tomorrow and blocks deployment."

## 8. Meeting AI

Meeting AI uses the same OpenClaw + GPT-5.6 foundation.

```text
Meeting notes / approved transcript
        |
        v
GPT-5.6
        |
        v
Summary + Decisions + Draft Action Items
        |
        v
Validation
        |
        v
User review
        |
        +--> Reject
        +--> Edit
        +--> Approve
                 |
                 v
              LOFT Tasks
```

AI-generated action items are drafts and must not automatically become tasks without approval.

## 9. Context Envelope

Every assistant request receives server-generated context:

```json
{
  "authenticated_user_id": "current-user",
  "active_team_id": "current-team-or-null",
  "client_current_timestamp": "current-local-timestamp"
}
```

Rules:

- The authenticated user ID comes from the verified session.
- The active team is context only, not authorization.
- Server-side membership checks are mandatory.
- Relative dates such as "tomorrow" and "next Friday" use the supplied current timestamp.

## 10. Confirmation Policy

### Normally no confirmation

- Agenda queries
- Summaries
- Search
- Priority explanations
- Message drafts
- Suggestions

### Confirmation required

- Creating a meeting
- Moving a meeting
- Deleting a task
- Changing assignment
- Bulk changes
- Sending externally visible messages where appropriate

Example:

```text
I found the Development Team workspace and prepared:

Development Sync
Friday, 10:00 AM
30 minutes
Attendees: Development Team

[Confirm] [Edit] [Cancel]
```

Only after confirmation should the backend execute the action.

## 11. Security Boundary

The model must never:

- Receive raw database credentials
- Execute arbitrary SQL
- Bypass RLS
- Decide authorization
- Access another team's private information because a prompt asks for it
- Claim an action succeeded before the server confirms success

Every tool call follows:

```text
Authenticated session
    |
    v
Tool allowlist
    |
    v
Zod input validation
    |
    v
Team membership / role check
    |
    v
RLS
    |
    v
Narrow backend operation
    |
    v
Validated result
```

## 12. V1 Demo Flow

```text
1. User opens LOFT.
2. User asks: "What do I need to do today?"
3. Assistant retrieves the user's permitted agenda.
4. GPT-5.6 summarizes it.
5. User says: "Add a task to finish the presentation tomorrow."
6. Assistant calls create_task.
7. Task appears in LOFT.
8. User asks: "What should I work on first?"
9. Smart Priority calculates the ranking.
10. GPT-5.6 explains the ranking.
11. User says: "Reprioritize my tasks."
12. My Plan updates.
13. User asks: "Schedule a meeting with Team B Friday at 10."
14. Assistant prepares the meeting.
15. User confirms.
16. Meeting appears in Calendar and notifications update.
17. User asks for a summary of relevant meeting/team content.
18. Meeting AI produces a reviewable summary and draft action items.
```

## 13. V1 Definition of Done

- [ ] OpenClaw is the V1 agent harness.
- [ ] GPT-5.6 is the single primary V1 reasoning model.
- [ ] Natural-language prompts work without special syntax.
- [ ] Tasks can be created and updated.
- [ ] Meetings can be prepared and created after confirmation.
- [ ] Workspace content can be summarized.
- [ ] My Plan data can be queried across permitted teams.
- [ ] Auto-Reprioritization uses LOFT's deterministic priority engine.
- [ ] Priority explanations are grounded in actual factors.
- [ ] Tool calls are server-side and authorized.
- [ ] Large unrelated workspace datasets are not sent to the model.
- [ ] Loading, confirmation, success, retry, and error states work.
- [ ] The complete demo can run repeatedly without manual database editing.
