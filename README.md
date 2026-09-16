# Newsela Assignment Workflow - Playwright Automation

Playwright (TypeScript) automation framework for the Newsela Writing
assignment creation workflow, built for the Senior Quality Engineer
take-home assessment.

## What's here

```
.
├── TEST_PLAN.md                        # Test plan (start here)
├── pages/                              # Page Object Model
│   ├── LoginPage.ts
│   ├── AssignmentsPage.ts
│   ├── CreateAssignmentModal.ts        # Steps 1-5 of the "Create Assignment" wizard
│   └── ConfirmationModal.ts            # "Your assignment is ready" modal
├── tests/
│   └── test_assignment-workflow_spec.ts  # Main E2E spec + Step 3 prompt cases
├── playwright.config.ts
├── package.json
└── .env.example
```

## Prerequisites

- Node.js 18+
- The test account credentials for `qe.demo.teacher` (provided with the
  assessment)

## Setup

```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env
```

Edit `.env` and confirm/fill in:

```
BASE_URL=https://everwrite.app.newsela.com/assignments
NEWSELA_USERNAME=qe.demo.teacher
NEWSELA_PASSWORD=LuiAn@fiDge1
```

`.env` is gitignored - credentials are never committed. `.env.example`
documents the required variables with placeholder-safe defaults for
`BASE_URL` only.

## Running the tests

```bash
npm test              # headless run of the full suite
npm run test:headed   # same, with a visible browser window
npm run test:debug    # Playwright inspector, step through interactively
npm run report        # open the last HTML report
```

To run only the main end-to-end happy path:

```bash
npx playwright test -g "@smoke"
```

To run only the Step 3 prompt-input cases:

```bash
npx playwright test -g "Step 3"
```

The main spec prints the captured assignment link to the console as part of
the test run (look for `Assignment link: https://...` in the output), and
Playwright also attaches a screenshot/video/trace on any failure
(`playwright-report/`, `test-results/`).

## Notes on the automation approach

- Locators favor Playwright's accessibility-first APIs (`getByRole`,
  `getByLabel`, `getByText`) over CSS/XPath so tests stay resilient to
  styling changes. A couple of fields in the "Create Assignment" modal
  lack proper label associations in the underlying markup; where that was
  the case, a documented proximity-based fallback locator is used instead
  (see comments in `pages/CreateAssignmentModal.ts` and the accessibility
  note in `TEST_PLAN.md`).
- The suite runs against the live Newsela QE demo environment (no mocking),
  so each run creates a real (harmless) assignment in that account - titles
  are timestamped (`QA Automation - ... <timestamp>`) so runs don't collide
  with each other or with manual testing in the same account.
- `workers: 1` and `fullyParallel: false` are set in `playwright.config.ts`
  because all tests share one live account; parallelizing could cause
  cross-test interference (e.g., two tests mid-modal at once). This can be
  revisited if/when tests get isolated test users.
