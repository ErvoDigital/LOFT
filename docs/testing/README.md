# LOFT tester questionnaire

Use [questionnaire.md](questionnaire.md) to review or manually copy the questions into Google Forms. Use [create-google-form.gs](create-google-form.gs) to generate the same questionnaire and a linked response spreadsheet in your own Google account.

The questionnaire is based on the current LOFT routes and feature code, including My Plan and shared documents. The repository README's feature-status list is older than some of that code. The presence of code does not establish that a deployed feature works; this test collects that evidence.

## Create the Google Form

1. Open [Google Apps Script](https://script.google.com/) while signed in to the account that should own the form, and create a new project.
2. Paste the entire contents of `create-google-form.gs` into `Code.gs`. Set `websiteUrl` to your test deployment and `buildLabel` to a release name or commit ID.
3. Save, select `createLoftTesterForm`, and click **Run**. Authorize the built-in Forms and Sheets access requested by Google. The script creates an unpublished draft and a response spreadsheet; it does not email anyone or distribute the form.
4. Open the **Draft edit URL** in the execution log. Review the wording, add your team's contact details and any required participant information, and check responder access for your testers. Account or organization policies may require sign-in even though automatic email collection and the one-response-per-user restriction are disabled.
5. Preview both consent paths: **No** should submit immediately; **Yes** should open the session questions. Check that no questions are shuffled and all tasks have their instructions.
6. Publish when ready, submit a practice response, verify that it reaches the linked response spreadsheet, and exclude it from the results. Share the responder link with your testers. Run the script only once unless you intentionally want a separate form: every run creates a new draft.

The script uses Google's documented [Forms service](https://developers.google.com/apps-script/reference/forms), including [form creation and spreadsheet destinations](https://developers.google.com/apps-script/reference/forms/form) and [multiple-choice navigation](https://developers.google.com/apps-script/reference/forms/multiple-choice-item). Its JavaScript and question construction can be checked locally; account authorization, live form behavior, and organizational access must be checked in Google.

## Prepare the test

- Agree on the intended MVP feature scope **before** collecting responses. This questionnaire covers 12 feature workflows currently exposed by LOFT. If a feature is outside your MVP, mark that in the analysis and do not claim it passed. If an in-scope feature cannot be tested, readiness remains unverified.
- Start with a small formative round, for example 6–10 people who resemble your intended users, including people who manage two or more teams. This is a practical starting point, not a statistically representative sample. Pair testers for collaboration tasks; include a mix of intended browsers and devices. Repeat after significant fixes and run a longer pilot to check continued use.
- Provide a reachable deployment, a build/session code, unique tester IDs, test email addresses or accounts, and a partner. Reserve approximately 60–75 minutes total including feedback; adjust after your practice session.
- Provide two isolated fixture workspaces per pair, such as `School-[pair ID]` and `Organization-[pair ID]`, with both testers as members. Make sure T01/T02 accounts are added to these workspaces before T05. Provide a valid invitation for T02 and the permission needed to send the partner an invitation from the tester-created workspace.
- Seed one incomplete task **assigned to each tester** and one upcoming event in each fixture workspace. Put all dates within the next 7 days, and state the exact date, local time, and timezone (for example Asia/Manila) in the session brief. For T06, use tomorrow's 10:00–11:00 and 10:30–11:30 events. For T07, use two incomplete assigned tasks with the same due date, plus a spare date with no other fixture task/event. Reset between testers so one person's change cannot remove another person's conflict fixture.
- For T08, the partner must be able to create/assign a new task. For T10, supply two small text files with visibly different contents, labelled V1 and V2; demonstrate only where the samples are, not how to use the controls. For T11, allow both people to open the test document. For T12, use separate browser sessions/devices, confirm microphone/camera availability, and include a pair on different networks if that matches real usage.
- Tell testers to use dummy content and attempt tasks without coaching. Give navigation help only after they ask or become stuck, record it, and have them select **It all worked with help** if all expected results then match. Missing accounts, denied permissions, or unavailable partners are setup blockers; broken behavior under a valid setup is a task failure.

## Record observations

Keep an observer sheet alongside the form with these columns:

`Session | Build | Tester ID | Task ID | Device/browser | Setup valid? | Start/end time | Outcome | Help given | Expected vs actual | Issue ID | Severity`

Use one row per tester per task. Observe both ends of chat, document, notification, and meeting tasks. Inspect saved data after refresh/reopen. Treat self-reported task success as preliminary until the observer or saved output confirms it. Break compound tasks into subchecks in your notes; a task passes only when every specified result matches. If registration is omitted in T01, report sign-in coverage separately and leave registration unverified.

Task timeboxes help the session progress; they are not latency specifications. Capture actual waits, lost data, failures after refresh, and confusion so the team can decide specific performance requirements. If a critical privacy/data issue occurs, preserve sanitized evidence and stop the affected workflow until investigated.

## Assess MVP readiness

Agree on acceptance criteria before testing. The following are suggested **project decision rules**, not a validated research scale or an industry standard:

| Evidence | Suggested criterion for the next pilot |
| --- | --- |
| Functional completion | At least 90% verified full completion, with or without help, for each in-scope core task under a valid setup. |
| Independent use | At least 80% verified independent completion for each in-scope core task. Report help separately. |
| Conflict detection | Both T06 and T07 meet the above criteria, with observer-confirmed fixtures, warnings, links, and removal of the resolved warning. |
| Perceived ease | Median at least 4/5 on the overall navigation question; report the section ratings separately. |
| User value | At least 70% of relevant multi-team testers rate the combined view and conflict warnings 4 or 5. Report valid response counts and excluded not-applicable/untested responses. |
| Willingness to use | At least 70% of relevant testers choose **Yes, as it is now**. Report conditional willingness separately; it identifies fixes needed before readiness. |
| Serious defects | Zero unresolved critical issues or major issues blocking an in-scope core workflow. |
| Coverage | Every in-scope workflow has valid attempts and verification on the intended launch devices/browsers. Missing coverage cannot count as a pass. |

For each task, let the valid-attempt denominator be independent completions + assisted completions + partial completions + attempted failures. Functional completion = (independent + assisted) / valid attempts; independent completion = independent / valid attempts. Exclude setup-blocked and not-attempted responses from these two rates, but report their counts and reasons separately. If someone chooses the answer about something missing for an application defect under valid setup, recode it as an attempted failure with an audit note. Verify the classifications against observer notes.

Also report **coverage = valid attempts / scheduled testers** for each task. A high completion rate among a few successful attempts does not resolve low coverage. No valid attempts means **untested**, not 0% success or a pass. Show counts next to percentages; with 6–10 testers, one person's response changes a percentage substantially. Do not present these exploratory thresholds as statistical proof.

If criteria are met, describe LOFT as **ready for the next limited MVP pilot for the tested build, users, and environments**. A one-session questionnaire cannot prove product-market fit, security, or sustained reliability. A pilot should also track actual return use and whether people continue coordinating real work in LOFT.

Prioritize critical data/access issues first, then workflow blockers and repeated confusion, then frequently requested improvements tied to real user needs. Record each fix's owner and verification task, and retest the affected workflow.

## Additional checks by the project team

These are outside the 12-task tester form but should be completed where relevant to the MVP scope:

- Verify account recovery and invite behavior in the intended environment, including an incorrect recipient, invalid/expired links, and wrong passwords.
- Test access with separate admin, ordinary-member, and nonmember accounts. Confirm denied access to restricted documents/folders and workspace files, including direct URLs; confirm workspace changes and role/permission controls are enforced by the server. Hidden UI controls alone do not prove access restrictions.
- Verify scheduled reminders separately; T08 tests assignment notification, not the reminder scheduler. Use known trigger times and record whether reminders fire once and link correctly.
- Include invalid dates, required-field errors, interrupted/retried uploads, keyboard navigation, mobile layouts, and reconnect behavior for chat/documents/meetings. Test cross-network audio/video, not just meeting signaling.

## Results template

> We tested LOFT build [build] on [date] with [n] testers, including [n] people coordinating multiple teams, on [devices/browsers]. Valid task coverage was [counts per task]. Verified functional and independent completion were [counts and rates per task]. [n/N] relevant testers rated the multi-team view highly and [n/N] rated conflict warnings highly. [n/N] would use this version as it is; [n/N] would use it after fixes. We found [critical/major issue counts] and prioritized [fixes]. Based on the criteria agreed before testing, this build is [ready / not yet ready / insufficiently tested] for a limited MVP pilot in the tested environments. Next verification: [tasks, owners, and dates].
