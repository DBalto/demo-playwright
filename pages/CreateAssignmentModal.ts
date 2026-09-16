import { Page, Locator, expect } from '@playwright/test';

export type AssignmentType = 'Literary Analysis' | 'Argumentative/Persuasive' | 'Narrative' | 'Expository';

/**
 * Represents the 5-step "Create Assignment" modal wizard that opens on top of
 * the editor when a teacher clicks "+ Create Assignment".
 *
 * The modal re-uses the same "Next" / "Back" controls across steps 1-4 (the
 * button is simply relabeled "Save assignment" on step 5), so those are
 * exposed once at the top level. Each step's own fields are grouped into
 * their own methods below, named after the step's on-screen heading, so a
 * test can read almost like the written test plan.
 *
 * Note: a handful of fields in this modal (assignment title, min/max word
 * count) are rendered without a proper <label for>/aria-labelledby
 * association - the accessible name Playwright resolves for them is just the
 * placeholder text ("Type here"), which is not unique. For those we fall
 * back to a heading-proximity locator (nearest input following the visible
 * field heading) instead of getByLabel, which would be ambiguous. This is
 * flagged as an accessibility observation in TEST_PLAN.md.
 */
export class CreateAssignmentModal {
  readonly page: Page;

  // Shared wizard controls
  readonly nextButton: Locator;
  readonly backButton: Locator;
  readonly saveAssignmentButton: Locator;
  readonly closeButton: Locator;

  // Step 1 - Newsela content source
  readonly contentUrlInput: Locator;
  readonly addContentButton: Locator;

  // Step 2 - Assignment Structure
  readonly minWordCountInput: Locator;
  readonly maxWordCountInput: Locator;

  // Step 3 - Prompt
  readonly regeneratePromptButton: Locator;
  readonly promptEditor: Locator;
  readonly promptCharacterCount: Locator;

  // Step 4 - Assignment Configurations
  readonly rubricSelect: Locator;

  constructor(page: Page) {
    this.page = page;

    this.nextButton = page.getByRole('button', { name: 'Next', exact: true });
    this.backButton = page.getByRole('button', { name: 'Back', exact: true });
    this.saveAssignmentButton = page.getByRole('button', { name: 'Save assignment' });
    this.closeButton = page.getByRole('button', { name: 'close' });

    this.contentUrlInput = page.getByPlaceholder('www.newsela.com');
    this.addContentButton = page.getByRole('button', { name: 'Add' });

    this.minWordCountInput = page
      .getByText('Minimum word count', { exact: true })
      .locator('xpath=following::input[1]');
    this.maxWordCountInput = page
      .getByText('Maximum word count', { exact: true })
      .locator('xpath=following::input[1]');

    this.regeneratePromptButton = page.getByRole('button', { name: 'Regenerate prompt' });
    this.promptEditor = page.getByRole('textbox', { name: 'Assignment writing prompt' });
    this.promptCharacterCount = page.getByText(/CHARACTERS:\s*[\d,]+\/[\d,]+/i);

    this.rubricSelect = page.getByRole('combobox', { name: 'Rubrics Selection' });
  }

  async waitUntilStepVisible(step: 1 | 2 | 3 | 4 | 5) {
    await expect(this.page.getByText(`Step ${step} of 5`)).toBeVisible();
  }

  private titleInput(): Locator {
    // Same "Type here" placeholder is reused for the title field on both
    // Step 2 and Step 5, so we scope by the field's heading to disambiguate
    // - but the heading text itself differs between the two steps ("Type a
    // title of assignment" on Step 2 vs. "Assignment Title" on Step 5), and
    // only one step's content is present/visible at a time. `.or()` matches
    // whichever of the two is currently on screen.
    const byStep2Heading = this.page
      .getByText('Type a title of assignment', { exact: true })
      .locator('xpath=following::input[1]');
    const byStep5Heading = this.page
      .getByText('Assignment Title', { exact: true })
      .locator('xpath=following::input[1]');
    return byStep2Heading.or(byStep5Heading);
  }

  // ---- Step 1: Newsela content source -----------------------------------

  /** Adds a Newsela article URL as content for the assignment. */
  async addContentSourceUrl(url: string) {
    await this.contentUrlInput.fill(url);
    await this.addContentButton.click();
  }

  // ---- Step 2: Assignment Structure --------------------------------------

  async setAssignmentTitle(title: string) {
    const input = this.titleInput();
    await input.fill('');
    await input.fill(title);
  }

  async setWordCountRange(min: number, max: number) {
    await this.minWordCountInput.fill(String(min));
    await this.maxWordCountInput.fill(String(max));
    // Both word-count fields are comboboxes with a suggestions dropdown
    // (e.g. 300/500/800/...) that stays open after fill() leaves the field
    // focused. Blurring it closes the dropdown so it can't visually cover -
    // and intercept clicks on - the assignment-type cards immediately below
    // it. Deliberately NOT `page.keyboard.press('Escape')`: that bubbles up
    // to the wizard modal's own Escape handler and was observed to open its
    // "You have unsaved changes" exit-confirmation dialog instead, hiding
    // the rest of Step 2 entirely.
    await this.maxWordCountInput.evaluate((el) => (el as HTMLElement).blur());
  }

  /**
   * Selects one of the assignment-type radio cards (Literary Analysis,
   * Argumentative/Persuasive, Narrative, Expository).
   *
   * Not `getByRole('radio', { name: type })`: the radio input in this
   * markup isn't wrapped by a <label> or given aria-label/aria-labelledby,
   * so it has no accessible name at all for Playwright to match against
   * (confirmed via the live DOM snapshot - it renders as a bare, unnamed
   * `radio` sibling of a `heading` with the type's name). The whole card is
   * clickable (cursor: pointer), so targeting the heading text and letting
   * the click bubble up to the card's handler is what actually selects it.
   */
  async selectAssignmentType(type: AssignmentType) {
    await this.page.getByRole('heading', { name: type, exact: true }).click();
  }

  // ---- Step 3: Prompt -----------------------------------------------------

  async getPromptText(): Promise<string> {
    return (await this.promptEditor.innerText()).trim();
  }

  async setPromptText(text: string) {
    await this.promptEditor.click();
    await this.page.keyboard.press('Control+A');
    await this.page.keyboard.press('Delete');
    await this.promptEditor.fill('');
    await this.promptEditor.type(text);
  }

  async regeneratePrompt() {
    await this.regeneratePromptButton.click();
  }

  async getPromptCharacterCountText(): Promise<string> {
    return (await this.promptCharacterCount.innerText()).trim();
  }

  // ---- Step 4: Assignment Configurations -----------------------------------

  async selectRubric(rubricName: string) {
    await this.rubricSelect.click();
    await this.page.getByRole('option', { name: rubricName }).click();
  }

  // ---- Step 5: Review assignment details -----------------------------------

  async getReviewTitleValue(): Promise<string> {
    return this.titleInput().inputValue();
  }

  // ---- Navigation -----------------------------------------------------------

  async clickNext() {
    await this.nextButton.click();
  }

  async clickBack() {
    await this.backButton.click();
  }

  /** Clicks "Save assignment" on Step 5 and waits for the confirmation modal's URL flag. */
  async saveAssignment() {
    await this.saveAssignmentButton.click();
    await this.page.waitForURL(/openConfirmationModal=true/);
  }

  /**
   * Convenience helper that walks Steps 1-4 with sensible defaults, leaving
   * the caller on Step 5 (Review) ready to inspect/save. Each argument is
   * optional so a test can override only what it cares about.
   */
  async completeStepsOneToFour(options?: {
    contentUrl?: string;
    title?: string;
    minWords?: number;
    maxWords?: number;
    assignmentType?: AssignmentType;
    promptText?: string;
    rubricName?: string;
  }) {
    // Step 1
    await this.waitUntilStepVisible(1);
    if (options?.contentUrl) {
      await this.addContentSourceUrl(options.contentUrl);
    }
    await this.clickNext();

    // Step 2
    await this.waitUntilStepVisible(2);
    if (options?.title) {
      await this.setAssignmentTitle(options.title);
    }
    if (options?.minWords !== undefined && options?.maxWords !== undefined) {
      await this.setWordCountRange(options.minWords, options.maxWords);
    }
    if (options?.assignmentType) {
      await this.selectAssignmentType(options.assignmentType);
    }
    await this.clickNext();

    // Step 3
    await this.waitUntilStepVisible(3);
    if (options?.promptText) {
      await this.setPromptText(options.promptText);
    }
    await this.clickNext();

    // Step 4
    await this.waitUntilStepVisible(4);
    if (options?.rubricName) {
      await this.selectRubric(options.rubricName);
    }
    await this.clickNext();

    // Step 5
    await this.waitUntilStepVisible(5);
  }
}
