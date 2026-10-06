# LOFT V1 AI Integration Update

> This document records the V1 AI architecture decisions that must be reflected in `LOFT_Development_Plan_Integrated_OpenClaw.md`.

## 1. V1 AI Stack

Use a deliberately simple architecture:

**LOFT Web App → OpenClaw → GPT-5.6 → LOFT backend tools → Supabase**

- OpenClaw is the agent harness/orchestration layer.
- GPT-5.6 is the single V1 reasoning model.
- LOFT backend remains the source of truth.
- Smart Priority remains deterministic and backend-controlled.

Do not add multiple LLM providers, model routing, or multiple specialist agents to the V1 critical path.

## 2. Required V1 AI Skills

The working demo should cover:

1. Natural-language workspace conversation
2. Task creation
3. Supported task updates
4. Meeting creation
5. Supported meeting changes
6. Message drafting
7. Content/meeting summarization
8. Cross-team agenda queries
9. Auto-Reprioritization
10. Explanation of priority changes

Voice interaction is a stretch feature, not a dependency for the core V1 demonstration.

## 3. V1 Tool Set

Implement only the tools required for the demo:

- `get_my_agenda`
- `create_task`
- `update_task`
- `create_meeting`
- `update_meeting`
- `search_workspace_content`
- `summarize_content`
- `draft_message`
- Optional: `send_message`

Avoid a generic database tool or arbitrary SQL tool.

## 4. Auto-Reprioritization Architecture

Do not ask GPT-5.6 to independently decide the complete task ranking.

The flow is:

```text
Active tasks
    ↓
LOFT Smart Priority engine
    ↓
Deterministic scores
    ↓
Ranked task list
    ↓
GPT-5.6 explanation
    ↓
My Plan
```

Suggested factors:

- deadline urgency
- urgency
- overdue status
- dependency/blocking impact
- status
- estimated effort/workload where available

The exact weights should remain configurable and testable.

## 5. Natural Prompt / Efficient Context Rule

Users should be able to say simple things such as:

> "Add a task to finish the presentation tomorrow."

The backend should do the expensive data work instead of putting everything into the model prompt.

```text
Simple user prompt
      ↓
GPT-5.6 identifies intent
      ↓
Approved LOFT tool
      ↓
Backend retrieves/writes only required data
      ↓
GPT-5.6 returns concise result
```

Do not send the entire workspace, entire chat history, or all tasks to the model for simple requests.

## 6. Updated Development Phase

### Phase 5 — V1 AI Workspace Agent + Auto-Reprioritization

#### 5A — Smart Priority

- [ ] Define priority factors and weights
- [ ] Implement deterministic scoring
- [ ] Display ranking in My Plan
- [ ] Display human-readable priority reasons
- [ ] Recalculate after meaningful changes
- [ ] Add before/after demo scenario
- [ ] Unit-test scoring
- [ ] Integration-test multi-team tasks

#### 5B — OpenClaw + GPT-5.6

- [ ] Configure OpenClaw Gateway
- [ ] Connect GPT-5.6
- [ ] Keep provider credentials server-side
- [ ] Implement streaming response handling
- [ ] Implement tool registration
- [ ] Implement server-generated context envelope
- [ ] Implement connection/retry states

#### 5C — Assistant UI

- [ ] Floating assistant button
- [ ] Assistant drawer
- [ ] Natural-language conversation
- [ ] Streaming responses
- [ ] Tool progress states
- [ ] Confirmation cards
- [ ] Error/retry states
- [ ] Active-team context indicator

#### 5D — V1 Tools

- [ ] `get_my_agenda`
- [ ] `create_task`
- [ ] `update_task`
- [ ] `create_meeting`
- [ ] `update_meeting`
- [ ] `search_workspace_content`
- [ ] `summarize_content`
- [ ] `draft_message`

#### 5E — Meeting AI

- [ ] Reuse OpenClaw + GPT-5.6 foundation
- [ ] Generate structured summary/action-item drafts
- [ ] Validate structured output
- [ ] Add human approval workflow
- [ ] Convert only approved action items into tasks

## 7. V1 Exit Test

The presenter must be able to:

1. Ask for today's agenda in natural language.
2. Create a task using ordinary wording.
3. Ask what should be done first.
4. Show the deterministic Smart Priority result.
5. Change a meaningful task factor and demonstrate Auto-Reprioritization.
6. Ask the assistant to prepare a meeting.
7. Confirm the meeting.
8. Show the meeting in Calendar.
9. Summarize relevant meeting/workspace content.
10. Show AI-generated action-item drafts.
11. Demonstrate that unauthorized team information is not exposed.

## 8. Explicitly Deferred

Move these to future versions:

- DeepSeek/model-provider routing
- Multiple LLMs
- Multiple agents
- Self-learning workflows
- Autonomous background actions
- Custom model training
- Advanced semantic retrieval
- Large-scale enterprise automation

The V1 objective is **reliable end-to-end demonstration**, not maximum AI complexity.

## 9. Demo and Stress-Testing Guidance

Before the presentation, test both correctness and cost efficiency.

### Correctness tests

- Natural-language task creation
- Task updates
- Meeting creation/change
- Summaries
- Cross-team agenda queries
- Priority explanations
- Auto-Reprioritization
- Unauthorized team requests
- Ambiguous requests requiring clarification
- Failed tool calls

### Efficiency tests

- Verify that simple requests retrieve only relevant records.
- Verify that the entire workspace is never sent unnecessarily.
- Bound conversation history.
- Keep tool results concise.
- Measure OpenRouter usage during several days of stress testing.
- Keep a presentation-day budget buffer.

The model should work harder internally so the user can keep prompts simple.

## 10. Product Statement

> **LOFT AI is a workspace agent that lets users naturally ask, plan, create, communicate, summarize, and reprioritize across their permitted teams, while LOFT remains responsible for the actual data, permissions, workflow logic, and final actions.**
