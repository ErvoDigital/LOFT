/**
 * LOFT Website Usability Test
 * Google Forms Generator
 *
 * Run: createLOFTUsabilityTestForm()
 */

function createLOFTUsabilityTestForm() {
  const form = FormApp.create("LOFT Website Usability Test");

  form.setDescription(
    "Thank you for testing LOFT!\n\n" +
    "During this session, you will use LOFT while a developer observes " +
    "how you interact with the website. The developer may help if you get " +
    "stuck, but please try each activity on your own first.\n\n" +
    "We are testing LOFT, not you. There are no right or wrong answers.\n\n" +
    "As you explore the website, please tell us whenever something is " +
    "confusing, difficult to find, useful, unnecessary, or different from " +
    "what you expected.\n\n" +
    "Your feedback will help us determine which features are useful, what " +
    "needs improvement, and what you would like to see in future versions " +
    "of LOFT."
  );

  form.setConfirmationMessage(
    "Thank you for testing LOFT!\n\n" +
    "Your feedback will help us understand which features are most useful, " +
    "what needs improvement, and what we should consider adding in future " +
    "versions.\n\n" +
    "Your responses will be reviewed together with observations made during " +
    "the testing session."
  );

  form.setProgressBar(true);
  form.setShuffleQuestions(false);

  // =========================================================
  // SECTION 1 — FIRST IMPRESSIONS
  // =========================================================

  addSection(
    form,
    "1. First Impressions",
    "Sign in using the test account provided to you. Spend a few minutes " +
    "exploring LOFT before answering these questions."
  );

  addScale(
    form,
    "After signing in, was it clear where you should start?",
    "Not clear at all",
    "Very clear",
    true
  );

  addParagraph(
    form,
    "What was the first feature or part of LOFT that caught your attention?",
    true
  );

  addParagraph(
    form,
    "Why did it catch your attention?",
    false
  );

  addParagraph(
    form,
    "Was there anything on the first screen that you did not understand?",
    true,
    'Write "None" if everything was clear.'
  );

  // =========================================================
  // SECTION 2 — WORKSPACES
  // =========================================================

  addSection(
    form,
    "2. Workspaces",
    "Complete the workspace activity given to you by the facilitator before " +
    "answering these questions."
  );

  addScale(
    form,
    "How easy was it to understand and switch between different workspaces?",
    "Very difficult",
    "Very easy",
    true
  );

  addMultipleChoice(
    form,
    "Was it clear which workspace you were currently viewing?",
    [
      "Very clear",
      "Clear",
      "Neither clear nor unclear",
      "Unclear",
      "Very unclear"
    ],
    true
  );

  addMultipleChoice(
    form,
    "Would you use separate LOFT workspaces for different teams, classes, organizations, or projects?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "Why or why not?",
    true
  );

  // =========================================================
  // SECTION 3 — TASKS
  // =========================================================

  addSection(
    form,
    "3. Tasks",
    "Complete the task management activity before answering."
  );

  addScale(
    form,
    "How easy was it to create and manage a task?",
    "Very difficult",
    "Very easy",
    true
  );

  addMultipleChoice(
    form,
    "Would you use LOFT's task system to keep track of your actual work?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "Why or why not?",
    true
  );

  addParagraph(
    form,
    "Is there anything you wish you could do with tasks that you could not do during the test?",
    false,
    "For example: subtasks, recurring tasks, reminders, dependencies, " +
    "attachments, different task views, or anything else you would find useful."
  );

  // =========================================================
  // SECTION 4 — CALENDAR AND EVENTS
  // =========================================================

  addSection(
    form,
    "4. Calendar and Events",
    "Complete the calendar and event activity before answering."
  );

  addScale(
    form,
    "How easy was it to create and manage an event?",
    "Very difficult",
    "Very easy",
    true
  );

  addMultipleChoice(
    form,
    "Would you use LOFT's calendar for your actual team schedules?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "Why or why not?",
    true
  );

  addParagraph(
    form,
    "What would you want LOFT's calendar to do that it currently does not?",
    false
  );

  // =========================================================
  // SECTION 5 — DASHBOARD AND MY PLAN
  // =========================================================

  addSection(
    form,
    "5. Dashboard and My Plan",
    "Use LOFT to find your upcoming work, deadlines, and events from the " +
    "different workspaces provided to you."
  );

  addScale(
    form,
    "How easy was it to find everything you needed to do?",
    "Very difficult",
    "Very easy",
    true
  );

  addScale(
    form,
    "How useful is having tasks and events from different workspaces together in one place?",
    "Not useful",
    "Extremely useful",
    true
  );

  addMultipleChoice(
    form,
    "Would this make it easier for you to manage work from multiple teams or groups?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "What other information would you want to see on your dashboard or My Plan?",
    false
  );

  // =========================================================
  // SECTION 6 — CONFLICTS AND WORKLOAD
  // =========================================================

  addSection(
    form,
    "6. Conflicts and Workload",
    "Complete the meeting conflict and task conflict activities before answering."
  );

  addScale(
    form,
    "How useful would warnings about overlapping meetings be to you?",
    "Not useful",
    "Extremely useful",
    true
  );

  addParagraph(
    form,
    "What would you want LOFT to do after detecting a meeting conflict?",
    false
  );

  addScale(
    form,
    "How useful would warnings about important tasks being due at the same time be to you?",
    "Not useful",
    "Extremely useful",
    true
  );

  addParagraph(
    form,
    "What would you want LOFT to do when it notices that you have too much work due at the same time?",
    false
  );

  // =========================================================
  // SECTION 7 — NOTIFICATIONS
  // =========================================================

  addSection(
    form,
    "7. Notifications",
    "Complete the notification activity before answering."
  );

  addMultipleChoice(
    form,
    "Was it clear what the notification was about?",
    [
      "Very clear",
      "Clear",
      "Somewhat clear",
      "Unclear",
      "Very unclear"
    ],
    true
  );

  addCheckboxes(
    form,
    "What kinds of notifications would you want LOFT to send you?",
    [
      "New task assigned to me",
      "Upcoming task deadline",
      "Overdue task",
      "New meeting or event",
      "Upcoming meeting reminder",
      "Meeting schedule conflict",
      "Task workload conflict",
      "New team message",
      "New private message",
      "File added or updated",
      "Document edited",
      "Changes to a task I'm involved in"
    ],
    false,
    true
  );

  addParagraph(
    form,
    "Are there any notifications you would NOT want to receive?",
    false
  );

  // =========================================================
  // SECTION 8 — MESSAGING
  // =========================================================

  addSection(
    form,
    "8. Messaging",
    "Complete the team and private messaging activities before answering."
  );

  addScale(
    form,
    "How easy was it to communicate with another person using LOFT?",
    "Very difficult",
    "Very easy",
    true
  );

  addMultipleChoice(
    form,
    "Would you use LOFT's messaging for your team or group projects?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "What would LOFT's messaging need for you to use it regularly?",
    false
  );

  // =========================================================
  // SECTION 9 — FILES AND DOCUMENTS
  // =========================================================

  addSection(
    form,
    "9. Files and Documents",
    "Complete the file management and collaborative document activities " +
    "before answering."
  );

  addScale(
    form,
    "How easy was it to upload, find, and manage files?",
    "Very difficult",
    "Very easy",
    true
  );

  addMultipleChoice(
    form,
    "Would keeping your team's files inside LOFT be useful to you?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addMultipleChoice(
    form,
    "Was the file version feature understandable?",
    [
      "Yes, immediately",
      "Yes, after exploring it",
      "I needed some help understanding it",
      "No, I did not understand it",
      "I did not test this feature"
    ],
    true
  );

  addMultipleChoice(
    form,
    "Would you use LOFT's collaborative documents to work with your team?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "What features would you want LOFT's files or document editor to have?",
    false
  );

  // =========================================================
  // SECTION 10 — VIDEO CALLS
  // =========================================================

  addSection(
    form,
    "10. Video Calls",
    "Complete the video call activity before answering."
  );

  addScale(
    form,
    "How easy was it to find and use the video call feature?",
    "Very difficult",
    "Very easy",
    true
  );

  addMultipleChoice(
    form,
    "Would having video calls directly inside LOFT be useful to you?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "What would you want LOFT's video calls to have in the future?",
    false
  );

  // =========================================================
  // SECTION 11 — FEATURES THEY WOULD ACTUALLY USE
  // =========================================================

  addSection(
    form,
    "11. Which Features Would You Actually Use?",
    "Think about everything you tried today. We want to know which features " +
    "you would actually use rather than simply which features worked."
  );

  addCheckboxes(
    form,
    "Which LOFT features would you actually use?",
    [
      "Workspaces",
      "Tasks",
      "Calendar and events",
      "Dashboard",
      "My Plan",
      "Meeting conflict warnings",
      "Task/workload warnings",
      "Notifications",
      "Team messaging",
      "Private messaging",
      "File sharing",
      "File versioning",
      "Collaborative documents",
      "Video calls",
      "None"
    ],
    true,
    true
  );

  // Q40 - checkbox with maximum 3 responses
  const topFeatures = form.addCheckboxItem();

  topFeatures
    .setTitle("Which THREE features are the most important to you?")
    .setHelpText("Select up to 3.")
    .setChoiceValues([
      "Workspaces",
      "Tasks",
      "Calendar and events",
      "Dashboard / My Plan",
      "Conflict and workload warnings",
      "Notifications",
      "Messaging",
      "Files",
      "Collaborative documents",
      "Video calls",
      "Other"
    ])
    .setRequired(true);

  const maxThreeValidation =
    FormApp.createCheckboxValidation()
      .requireSelectAtMost(3)
      .setHelpText("Please select no more than 3 features.")
      .build();

  topFeatures.setValidation(maxThreeValidation);

  addMultipleChoice(
    form,
    "Out of everything you tried, which ONE feature would you probably use the most?",
    [
      "Workspaces",
      "Tasks",
      "Calendar and events",
      "Dashboard / My Plan",
      "Conflict and workload warnings",
      "Notifications",
      "Messaging",
      "Files",
      "Collaborative documents",
      "Video calls",
      "Other"
    ],
    true
  );

  addParagraph(
    form,
    "Why would you use that feature the most?",
    true
  );

  // =========================================================
  // SECTION 12 — WHAT'S MISSING?
  // =========================================================

  addSection(
    form,
    "12. What Do You Want LOFT to Have?",
    "Now forget about what LOFT currently has for a moment.\n\n" +
    "Think about what would genuinely make LOFT more useful for your " +
    "schoolwork, organizations, projects, or teams.\n\n" +
    "There are no wrong or unrealistic answers. We want to know what you " +
    "would want LOFT to become."
  );

  addParagraph(
    form,
    "While using LOFT, was there anything you expected to be able to do but could not?",
    true,
    'Write "None" if nothing comes to mind.'
  );

  addParagraph(
    form,
    "What feature do you wish LOFT had?",
    true,
    "Do not worry about whether it would be difficult for us to build. " +
    "Tell us what would genuinely make LOFT more useful to you."
  );

  addParagraph(
    form,
    "Is there something you currently use another app or website for that you wish you could do directly inside LOFT?",
    true,
    "If yes, tell us what you currently use and what you would want LOFT " +
    'to do. Write "None" if nothing comes to mind.'
  );

  addParagraph(
    form,
    "What would make you choose LOFT instead of switching between several different apps?",
    true
  );

  addParagraph(
    form,
    "Is there anything currently in LOFT that you think you would rarely or never use?",
    false
  );

  addParagraph(
    form,
    "Is there anything you think LOFT should do automatically for you?",
    false,
    "Think about repetitive work, scheduling, reminders, organizing tasks, " +
    "prioritizing work, summaries, or anything else you normally have to do yourself."
  );

  // =========================================================
  // SECTION 13 — FINAL THOUGHTS
  // =========================================================

  addSection(
    form,
    "13. Final Thoughts",
    "Think about your overall experience using LOFT today."
  );

  addMultipleChoice(
    form,
    "Based on what you tried today, would you use LOFT for a real team, school project, organization, or group?",
    [
      "Definitely",
      "Probably",
      "Maybe",
      "Probably not",
      "Definitely not"
    ],
    true
  );

  addParagraph(
    form,
    "What is the main reason for your answer?",
    true
  );

  addParagraph(
    form,
    "What is the best thing about LOFT right now?",
    true
  );

  addParagraph(
    form,
    "What is the FIRST thing we should improve?",
    true
  );

  addParagraph(
    form,
    "What is the FIRST feature you think we should add?",
    true
  );

  addParagraph(
    form,
    "If LOFT added the features you need, what would make you keep using it?",
    false
  );

  addParagraph(
    form,
    "Is there anything else you wish LOFT could do for you?",
    false
  );

  addParagraph(
    form,
    "Is there anything else you would like to tell us about your experience using LOFT?",
    false
  );

  // =========================================================
  // CREATE RESPONSE SPREADSHEET
  // =========================================================

  const spreadsheet = SpreadsheetApp.create(
    "LOFT Website Usability Test - Responses"
  );

  form.setDestination(
    FormApp.DestinationType.SPREADSHEET,
    spreadsheet.getId()
  );

  // =========================================================
  // OUTPUT LINKS
  // =========================================================

  Logger.log("==============================================");
  Logger.log("LOFT USABILITY TEST CREATED");
  Logger.log("==============================================");
  Logger.log("EDIT FORM:");
  Logger.log(form.getEditUrl());
  Logger.log("");
  Logger.log("PARTICIPANT FORM:");
  Logger.log(form.getPublishedUrl());
  Logger.log("");
  Logger.log("RESPONSE SPREADSHEET:");
  Logger.log(spreadsheet.getUrl());
  Logger.log("==============================================");
}


/**
 * Adds a new Google Forms section.
 */
function addSection(form, title, description) {
  const section = form.addPageBreakItem();
  section.setTitle(title);

  if (description) {
    section.setHelpText(description);
  }

  return section;
}


/**
 * Adds a 1–5 linear scale.
 */
function addScale(form, title, lowLabel, highLabel, required) {
  const item = form.addScaleItem();

  item
    .setTitle(title)
    .setBounds(1, 5)
    .setLabels(lowLabel, highLabel)
    .setRequired(required);

  return item;
}


/**
 * Adds a multiple-choice question.
 */
function addMultipleChoice(form, title, choices, required) {
  const item = form.addMultipleChoiceItem();

  item
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(required);

  return item;
}


/**
 * Adds a paragraph/long-answer question.
 */
function addParagraph(form, title, required, helpText) {
  const item = form.addParagraphTextItem();

  item
    .setTitle(title)
    .setRequired(required);

  if (helpText) {
    item.setHelpText(helpText);
  }

  return item;
}


/**
 * Adds a checkbox question.
 */
function addCheckboxes(
  form,
  title,
  choices,
  required,
  showOther
) {
  const item = form.addCheckboxItem();

  item
    .setTitle(title)
    .setChoiceValues(choices)
    .setRequired(required);

  if (showOther) {
    item.showOtherOption(true);
  }

  return item;
}