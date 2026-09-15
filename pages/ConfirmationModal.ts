import { Page, Locator, expect } from '@playwright/test';

/**
 * Represents the "Your assignment is ready" confirmation modal that appears
 * after saving an assignment, containing the shareable assignment link.
 */
export class ConfirmationModal {
  readonly page: Page;
  readonly heading: Locator;
  readonly assignmentLinkInput: Locator;
  readonly copyLinkButton: Locator;
  readonly sendToGoogleClassroomButton: Locator;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Your assignment is ready' });
    // The link field is a read-only text input; scope to it by locating the
    // textbox that sits within this confirmation dialog rather than by an
    // accessible name (the input has none).
    this.assignmentLinkInput = page
      .getByText('Assignment link', { exact: true })
      .locator('xpath=following::input[1]');
    this.copyLinkButton = page.getByRole('button', { name: 'Copy link' });
    this.sendToGoogleClassroomButton = page.getByRole('button', { name: 'Send to Google Classroom' });
    this.closeButton = page.getByRole('button', { name: 'close' });
  }

  async waitUntilVisible() {
    await expect(this.heading).toBeVisible();
  }

  /** Reads and returns the assignment link shown in the modal. */
  async getAssignmentLink(): Promise<string> {
    await expect(this.assignmentLinkInput).toBeVisible();
    const link = await this.assignmentLinkInput.inputValue();
    expect(link, 'Assignment link should not be empty').toBeTruthy();
    return link;
  }

  async copyLink() {
    await this.copyLinkButton.click();
  }

  async close() {
    await this.closeButton.click();
  }
}
