import { test, expect, Page } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { AssignmentsPage } from '../pages/AssignmentsPage';
import { CreateAssignmentModal } from '../pages/CreateAssignmentModal';
import { ConfirmationModal } from '../pages/ConfirmationModal';

/**
 * End-to-end happy path for the Newsela Writing assignment creation workflow:
 *
 *   1. Log in with the QE demo teacher account
 *   2. Open the "Create Assignment" modal
 *   3. Walk Steps 1-5, filling in the fields the test plan calls out
 *   4. Save the assignment
 *   5. Verify the "Your assignment is ready" confirmation modal appears
 *   6. Capture and print the assignment link
 *
 * See TEST_PLAN.md for the full scenario matrix this flow is drawn from,
 * including the Step 3 prompt-input cases that are covered in dedicated
 * tests further down this file.
 */

const USERNAME = process.env.NEWSELA_USERNAME ?? '';
const PASSWORD = process.env.NEWSELA_PASSWORD ?? '';

/**
 * Logs in and opens the Create Assignment modal, landing on Step 3 (the
 * prompt editor) with a default title/type/word-count already filled in on
 * Step 2. Shared by the Step 3-focused test cases below so each of them can
 * start from the same known state.
 */
async function arriveAtPromptStep(page: Page): Promise<CreateAssignmentModal> {
  const loginPage = new LoginPage(page);
  const assignmentsPage = new AssignmentsPage(page);
  const createAssignmentModal = new CreateAssignmentModal(page);

  await loginPage.goto('/');
  await loginPage.waitUntilLoaded();
  await loginPage.login(USERNAME, PASSWORD);
  await assignmentsPage.waitUntilLoaded();

  await assignmentsPage.clickCreateAssignment();
  await createAssignmentModal.waitUntilStepVisible(1);
  await createAssignmentModal.clickNext();

  await createAssignmentModal.waitUntilStepVisible(2);
  await createAssignmentModal.setAssignmentTitle(`QA Automation - Prompt Case ${Date.now()}`);
  await createAssignmentModal.setWordCountRange(50, 250);
  await createAssignmentModal.selectAssignmentType('Literary Analysis');
  await createAssignmentModal.clickNext();

  await createAssignmentModal.waitUntilStepVisible(3);
  return createAssignmentModal;
}

test.describe('Newsela assignment creation workflow', () => {
  test.beforeEach(async () => {
    expect(
      USERNAME && PASSWORD,
      'NEWSELA_USERNAME and NEWSELA_PASSWORD must be set (see .env.example).'
    ).toBeTruthy();
  });

  test('teacher can create an assignment end-to-end and receive a shareable link @smoke', async ({ page }) => {
    const loginPage = new LoginPage(page);
    const assignmentsPage = new AssignmentsPage(page);
    const createAssignmentModal = new CreateAssignmentModal(page);
    const confirmationModal = new ConfirmationModal(page);

    const assignmentTitle = `QA Automation - Happy Path ${Date.now()}`;
    const prompt =
      'Write a literary analysis explaining how the main character changes from the ' +
      'beginning of the story to the end. Use at least two pieces of evidence from the text ' +
      'to support your interpretation.';

    await test.step('Log in with valid credentials', async () => {
      await loginPage.goto('/');
      await loginPage.waitUntilLoaded();
      await loginPage.login(USERNAME, PASSWORD);
      await assignmentsPage.waitUntilLoaded();
    });

    await test.step('Open the Create Assignment modal', async () => {
      await assignmentsPage.clickCreateAssignment();
      await createAssignmentModal.waitUntilStepVisible(1);
    });

    await test.step('Complete Steps 1-4 of the modal', async () => {
      await createAssignmentModal.completeStepsOneToFour({
        title: assignmentTitle,
        minWords: 50,
        maxWords: 250,
        assignmentType: 'Literary Analysis',
        promptText: prompt,
      });
    });

    await test.step('Review details on Step 5 and save the assignment', async () => {
      // The Step 5 title field is an editable <input> showing the title as
      // its *value*, not as rendered text, so getByText() can never match
      // it - read the input's value instead.
      await expect(await createAssignmentModal.getReviewTitleValue()).toBe(assignmentTitle);
      await createAssignmentModal.saveAssignment();
    });

    await test.step('Verify the confirmation modal appears', async () => {
      await confirmationModal.waitUntilVisible();
      await expect(confirmationModal.heading).toHaveText('Your assignment is ready');
    });

    await test.step('Capture and print the assignment link', async () => {
      const assignmentLink = await confirmationModal.getAssignmentLink();

      expect(assignmentLink).toMatch(/^https:\/\/.+\/editor\?code=.+$/);

      // eslint-disable-next-line no-console
      console.log(`Assignment link: ${assignmentLink}`);
    });
  });
});

/**
 * Focused coverage for Step 3, "Type the prompt your students will respond
 * to" - see TEST_PLAN.md section 3 for the full scenario matrix these are
 * drawn from. These target the highest-risk cases given the assessment's
 * time box: an empty prompt reaching save, special/unicode character
 * handling, and character-counter accuracy.
 */
test.describe('Step 3: Assignment prompt input', () => {
  test.beforeEach(async () => {
    expect(
      USERNAME && PASSWORD,
      'NEWSELA_USERNAME and NEWSELA_PASSWORD must be set (see .env.example).'
    ).toBeTruthy();
  });

  test('character counter reflects the length of a manually typed prompt', async ({ page }) => {
    const modal = await arriveAtPromptStep(page);

    const customPrompt = 'Describe the turning point of the story in your own words.';
    await modal.setPromptText(customPrompt);

    const counterText = await modal.getPromptCharacterCountText();
    const [, countedLength] = counterText.match(/CHARACTERS:\s*([\d,]+)\//i) ?? [];

    expect(countedLength?.replace(/,/g, '')).toBe(String(customPrompt.length));
  });

  test('special characters and unicode are preserved without corruption or script execution', async ({ page }) => {
    const modal = await arriveAtPromptStep(page);

    const trickyPrompt = 'Analyze <script>alert("xss")</script> "quoted" text, é/ñ/中文, and emoji 📚✍️.';
    await modal.setPromptText(trickyPrompt);

    // No JS dialog should fire from unsanitized markup being executed.
    page.on('dialog', (dialog) => {
      throw new Error(`Unexpected dialog triggered by prompt input: ${dialog.message()}`);
    });

    const editorText = await modal.getPromptText();
    expect(editorText).toContain('quoted');
    expect(editorText).toContain('é/ñ/中文');
    expect(editorText).toContain('📚');
  });

  test('an empty prompt does not silently pass through to a saved assignment', async ({ page }) => {
    const modal = await arriveAtPromptStep(page);

    await modal.setPromptText('');
    await modal.clickNext();

    // Two acceptable outcomes for a required field: either Next is blocked
    // (Step 3 is still showing), or the app surfaces a visible validation
    // message before allowing the user to proceed. Silently advancing to
    // Step 4 with a blank prompt would be the failure mode this test guards
    // against - if that happens, the assertion below fails and flags it for
    // manual follow-up (see TEST_PLAN.md section 3.1, case 5).
    const stillOnStep3 = await page.getByText('Step 3 of 5').isVisible();
    const validationMessageShown = await page
      .getByText(/prompt.*(required|empty|cannot be blank)/i)
      .isVisible()
      .catch(() => false);

    expect(
      stillOnStep3 || validationMessageShown,
      'Expected empty prompt to block progression or show a validation message, ' +
        'but the modal advanced past Step 3 with no visible warning.'
    ).toBeTruthy();
  });
});
