/**
 * Paste this whole file into Code.gs at https://script.google.com/.
 * Run createLoftTesterForm once. Each run creates a new unpublished draft.
 * Review the draft, test a response, then publish it in Google Forms.
 * Uses only Google's built-in Forms and Sheets services; no API key required.
 */
const LOFT_FORM_CONFIG = {
  websiteUrl: '[Insert the LOFT test website URL before sharing]',
  buildLabel: '[Insert the tested build/version before sharing]',
  createResponseSheet: true
};

const LOFT_OUTCOMES = [
  "It all worked without help",
  "It all worked with help",
  "Some steps did not work",
  "I tried but could not finish",
  "I was missing something needed for this activity",
  "I did not try it"
];

const LOFT_QUESTIONNAIRE = {
  "title": "LOFT Website Test and Feedback",
  "description": "Try LOFT and tell us what works and what needs fixing. Allow about 45-60 minutes to try it and 8-12 minutes to answer this form. Use the test details we give you. Do not share passwords or private information. Taking part is your choice. You can stop at any time. Our team will use your answers to improve LOFT. Please send one response per test session.",
  "consent": {
    "title": "Do you agree to take part and let us use your answers to improve LOFT?",
    "yes": "Yes, I agree",
    "no": "No, I do not agree"
  },
  "sections": [
    {
      "id": "background",
      "title": "1. About you and your device",
      "description": "Keep this form open in one tab and LOFT in another. We will give you the website link, test codes, and a partner.",
      "questions": [
        {
          "type": "text",
          "title": "What is your tester code?",
          "help": "Enter the code we gave you, such as T01. Do not enter your full name.",
          "required": true
        },
        {
          "type": "text",
          "title": "What is your test session code?",
          "help": "Enter the session code we gave you.",
          "required": true
        },
        {
          "type": "choice",
          "title": "Which device are you using for this test?",
          "choices": [
            "Laptop or desktop",
            "Phone",
            "Tablet"
          ],
          "other": true,
          "required": true
        },
        {
          "type": "text",
          "title": "What browser are you using, and on what device?",
          "help": "For example: Chrome on Windows 11, or Safari on iPhone. If you are unsure, ask us for help.",
          "required": true
        },
        {
          "type": "choice",
          "title": "How many teams or groups are you part of?",
          "choices": [
            "0",
            "1",
            "2",
            "3 or more"
          ],
          "required": true
        },
        {
          "type": "choice",
          "title": "How often do you use apps for tasks, schedules, or team work?",
          "choices": [
            "Never",
            "Less than once a week",
            "Every week",
            "Every day"
          ],
          "required": true
        },
        {
          "type": "paragraph",
          "title": "How do you keep track of your tasks and schedules now?",
          "help": "Name the apps or methods you use. What is difficult about them?",
          "required": false
        }
      ]
    },
    {
      "id": "tasks-a",
      "title": "2. Try the basics",
      "description": "Try each activity, then tell us how it went. Choose \"It all worked\" only if everything under \"Check\" is true. Say if you needed help. If something you need is missing, choose that answer. If you are stuck for 5 minutes, move on and tell us later. A workspace is a separate space for a team. Use your tester code in the names below.",
      "tasks": [
        {
          "id": "T01",
          "name": "Sign in and out",
          "action": "1. Create an account with the test email we gave you.\n2. Sign out, then sign in again.\n3. If you already have a test account, just sign in and out. Tell us later that you did not try signing up.",
          "expected": "You can sign in and out. After signing out, you must sign in again to open your dashboard."
        },
        {
          "id": "T02",
          "name": "Create and join a team space",
          "action": "1. Create a workspace named TEST-[your code].\n2. Invite your partner and ask them to join.\n3. Join the other workspace using the invitation we gave you.\n4. Switch between the two workspaces.",
          "expected": "The right people appear in each workspace. Each workspace shows its own name and content."
        },
        {
          "id": "T03",
          "name": "Add and update a task",
          "action": "1. Create Task-[your code] in your test workspace.\n2. Assign it to yourself. Set a priority and a due date in the next 7 days.\n3. Move it from To Do to In Progress, then Completed.\n4. Reload the page and open the task again.",
          "expected": "The task is in Completed. Its name, assigned person, priority, due date, and status are still correct."
        },
        {
          "id": "T04",
          "name": "Add and change an event",
          "action": "1. Create Event-[your code] for a date in the next 7 days.\n2. Set a start and end time. Use the time zone we agreed on.\n3. Add your partner as an attendee. Ask them to check the event.\n4. Change the time and reload the page.",
          "expected": "Both of you see the right event, date, time, and attendees. The new time stays after reloading."
        }
      ],
      "questions": [
        {
          "type": "scale",
          "title": "How easy was this part of the test?",
          "low": 1,
          "high": 5,
          "left": "Very hard",
          "right": "Very easy",
          "required": false
        }
      ]
    },
    {
      "id": "tasks-b",
      "title": "3. Find work from different teams",
      "description": "Use the School and Organization workspaces we prepared. We will tell you which tasks, events, and dates to use. Use the unfinished tasks we gave you.",
      "tasks": [
        {
          "id": "T05",
          "name": "Find work from both teams",
          "action": "1. Open the main dashboard and My Plan.\n2. In both places, find the unfinished tasks and upcoming events we prepared for both teams.\n3. Use the links to open a task and an event.",
          "expected": "Both teams appear with the right task and event details. The links open the right task or calendar."
        },
        {
          "id": "T06",
          "name": "Find meetings at the same time",
          "action": "1. Find tomorrow's School event at 10:00-11:00 and Organization event at 10:30-11:30. Use the agreed time zone.\n2. Find the warning about these meetings.\n3. Open both event links.\n4. Tell us which meetings overlap.",
          "expected": "The warning names both events and teams. Both links open the right calendars. You do not need to change the meeting times."
        },
        {
          "id": "T07",
          "name": "Find tasks due on the same day",
          "action": "1. Find the two unfinished tasks we gave you, one in each workspace. Both are assigned to you and due on the same day.\n2. Find the warning about their due dates.\n3. Change one task to the new date we gave you.\n4. Reload the dashboard or My Plan.",
          "expected": "The warning shows both tasks at first. After the date change and reload, that warning is gone. Other warnings may stay."
        },
        {
          "id": "T08",
          "name": "Check a new alert",
          "action": "1. Stay signed in. Ask your partner to assign Notification-[your code] to you.\n2. Open the bell icon, then the new task alert.\n3. Mark it as read.",
          "expected": "The alert names the right task and team. Its link opens the task or its task board. It shows as read after you mark it."
        }
      ],
      "questions": [
        {
          "type": "scale",
          "title": "How easy was this part of the test?",
          "low": 1,
          "high": 5,
          "left": "Very hard",
          "right": "Very easy",
          "required": false
        }
      ]
    },
    {
      "id": "tasks-c",
      "title": "4. Work with your partner",
      "description": "Use separate accounts, each on your own browser or device. For the video call, allow camera and microphone access. Use headphones if you have them. If your partner or equipment is unavailable, choose the answer about something missing.",
      "tasks": [
        {
          "id": "T09",
          "name": "Send messages",
          "action": "1. Send Message-[your code] in the team chat. Ask your partner to reply.\n2. Send your partner a private message. Ask for a reply.\n3. Reload both chats.",
          "expected": "Messages appear without reloading first. The names and messages are correct. Messages stay after reloading."
        },
        {
          "id": "T10",
          "name": "Upload and download files",
          "action": "1. Upload the first sample file we gave you.\n2. Download it and open it.\n3. Add the second sample as a new version of that file.\n4. Open the version list and download both versions.",
          "expected": "The first download has the right content. Both versions are under one file entry. You can download both, and each has the right content."
        },
        {
          "id": "T11",
          "name": "Write together in a document",
          "action": "1. Create Doc-[your code] and write a short sentence.\n2. Keep it open. Ask your partner to open it and add another sentence.\n3. Wait until both sentences appear.\n4. Close and reopen the document.",
          "expected": "Both of you see both sentences without reloading. The name and both sentences stay after reopening. No text is lost or replaced."
        },
        {
          "id": "T12",
          "name": "Try a video call",
          "action": "1. Join the same workspace call as your partner.\n2. Check that you can both hear and see each other.\n3. Turn your microphone and camera off and on. Ask your partner to check each change.\n4. Leave the call.",
          "expected": "Both of you can hear and see each other. Turning the microphone or camera off stops your sound or video; turning it on brings it back. Your partner can see that you left."
        }
      ],
      "questions": [
        {
          "type": "scale",
          "title": "How easy was this part of the test?",
          "low": 1,
          "high": 5,
          "left": "Very hard",
          "right": "Very easy",
          "required": false
        },
        {
          "type": "choice",
          "title": "About how long did you spend trying the website?",
          "choices": [
            "Under 30 minutes",
            "30–44 minutes",
            "45–60 minutes",
            "Over 60 minutes",
            "I do not know"
          ],
          "required": true
        }
      ]
    },
    {
      "id": "issues",
      "title": "5. Tell us about any problems",
      "description": "Tell us what went wrong or why you skipped an activity. Include its code, such as T03. Do not share passwords or private information.",
      "questions": [
        {
          "type": "choice",
          "title": "What was your biggest problem?",
          "choices": [
            "No problems",
            "A small issue with how something looked or worked",
            "Something was confusing or slow, or I needed help",
            "I could not finish an important activity",
            "My work was lost or someone could see private content",
            "I was missing an account, access, partner, or equipment"
          ],
          "required": true
        },
        {
          "type": "paragraph",
          "title": "What went wrong, or what could you not try?",
          "help": "For each problem, tell us:\n1. Which activity was it?\n2. What did you do?\n3. What should have happened?\n4. What happened instead?\n5. Did you need help? Did it happen again?\nIf you skipped something, say why. For the video call, say whether you used the same Wi-Fi or different connections. Write \"None\" if there were no problems.",
          "required": true
        },
        {
          "type": "paragraph",
          "title": "Was anything confusing, hard to find, or slow?",
          "help": "Tell us where it happened. If it was slow, about how long did you wait? Did it happen again? Write \"None\" if there were no problems.",
          "required": true
        },
        {
          "type": "text",
          "title": "Link to a screenshot or video (optional)",
          "help": "Paste a link we can open. Remove private information first. You can leave this blank.",
          "required": false
        }
      ]
    },
    {
      "id": "value",
      "title": "6. What do you think of LOFT?",
      "description": "Tell us what you think based on what you tried today.",
      "questions": [
        {
          "type": "scale",
          "title": "How easy was it to find what you needed in LOFT?",
          "low": 1,
          "high": 5,
          "left": "Very hard",
          "right": "Very easy",
          "required": true
        },
        {
          "type": "choice",
          "title": "Would seeing all your teams' tasks and events in one place help you?",
          "choices": [
            "1 - Not useful",
            "2 - A little useful",
            "3 - Somewhat useful",
            "4 - Very useful",
            "5 - Extremely useful",
            "This does not apply to me"
          ],
          "required": true
        },
        {
          "type": "choice",
          "title": "Would alerts about meetings at the same time or tasks due on the same day help you?",
          "choices": [
            "1 - Not useful",
            "2 - A little useful",
            "3 - Somewhat useful",
            "4 - Very useful",
            "5 - Extremely useful",
            "I could not test this properly",
            "This does not apply to me"
          ],
          "required": true
        },
        {
          "type": "choice",
          "title": "Would you use LOFT for a real team or group project?",
          "choices": [
            "Yes, as it is now",
            "Yes, after some problems are fixed",
            "I am not sure",
            "No",
            "This does not apply to me"
          ],
          "required": true
        },
        {
          "type": "paragraph",
          "title": "Why did you choose that answer?",
          "help": "Tell us why you would or would not use LOFT. What needs fixing first?",
          "required": true
        },
        {
          "type": "paragraph",
          "title": "What should we improve first?",
          "help": "Suggest one change and say how it would help. Write \"None\" if you have no suggestion.",
          "required": true
        },
        {
          "type": "paragraph",
          "title": "What part of LOFT helped you the most, and why?",
          "required": false
        },
        {
          "type": "paragraph",
          "title": "Anything else you want to tell us?",
          "required": false
        }
      ]
    }
  ]
};

function createLoftTesterForm() {
  const form = FormApp.create(LOFT_QUESTIONNAIRE.title, false);
  // Log immediately so the draft remains findable if a later step fails.
  Logger.log('Draft edit URL: ' + form.getEditUrl());
  form.setDescription(LOFT_QUESTIONNAIRE.description + '\n\nWebsite: ' + LOFT_FORM_CONFIG.websiteUrl + '\nWebsite version: ' + LOFT_FORM_CONFIG.buildLabel);
  form.setCollectEmail(false);
  form.setLimitOneResponsePerUser(false);
  form.setShuffleQuestions(false);
  form.setProgressBar(true);
  form.setPublishingSummary(false);
  form.setConfirmationMessage('Thank you! Your feedback will help us improve LOFT. If you chose not to take part, you do not need to do anything else.');

  const consentItem = form.addMultipleChoiceItem()
    .setTitle(LOFT_QUESTIONNAIRE.consent.title)
    .setRequired(true);
  let firstPage;

  LOFT_QUESTIONNAIRE.sections.forEach(function (section) {
    const page = form.addPageBreakItem().setTitle(section.title).setHelpText(section.description);
    if (!firstPage) firstPage = page;
    (section.tasks || []).forEach(function (task) {
      form.addMultipleChoiceItem()
        .setTitle(task.id + ': ' + task.name + ' — how did it go?')
        .setHelpText('Try this:\n' + task.action + '\n\nCheck: ' + task.expected)
        .setChoiceValues(LOFT_OUTCOMES)
        .setRequired(true);
    });
    (section.questions || []).forEach(function (question) {
      addLoftQuestion_(form, question);
    });
  });

  consentItem.setChoices([
    consentItem.createChoice(LOFT_QUESTIONNAIRE.consent.yes, firstPage),
    consentItem.createChoice(LOFT_QUESTIONNAIRE.consent.no, FormApp.PageNavigationType.SUBMIT)
  ]);

  if (LOFT_FORM_CONFIG.createResponseSheet) {
    const sheet = SpreadsheetApp.create('LOFT Tester Responses — ' + LOFT_FORM_CONFIG.buildLabel);
    form.setDestination(FormApp.DestinationType.SPREADSHEET, sheet.getId());
    Logger.log('Response spreadsheet: ' + sheet.getUrl());
  }
  Logger.log('Draft complete. Review settings and preview, then publish in Google Forms.');
  return form.getEditUrl();
}

function addLoftQuestion_(form, question) {
  let item;
  switch (question.type) {
    case 'text': item = form.addTextItem(); break;
    case 'paragraph': item = form.addParagraphTextItem(); break;
    case 'choice':
      item = form.addMultipleChoiceItem().setChoiceValues(question.choices);
      if (question.other) item.showOtherOption(true);
      break;
    case 'scale':
      item = form.addScaleItem().setBounds(question.low, question.high).setLabels(question.left, question.right);
      break;
    default: throw new Error('Unsupported question type: ' + question.type);
  }
  item.setTitle(question.title).setRequired(Boolean(question.required));
  if (question.help) item.setHelpText(question.help);
}
