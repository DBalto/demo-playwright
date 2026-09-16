import { Page, Locator, expect } from '@playwright/test';

/**
 * Represents the "Assignments" landing page (writing.app.newsela.com/assignments),
 * the teacher's home base after logging in.
 */
export class AssignmentsPage {
  readonly page: Page;
  readonly heading: Locator;
  readonly createAssignmentButton: Locator;
  readonly searchInput: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: 'Assignments' });
    this.createAssignmentButton = page.getByRole('button', { name: '+ Create Assignment' })
      .or(page.getByRole('button', { name: 'Create Assignment' }));
    this.searchInput = page.getByPlaceholder('Search in assignments');
  }

  async waitUntilLoaded() {
    await expect(this.page).toHaveURL(/\/assignments/);
    await expect(this.createAssignmentButton).toBeVisible();
  }

  /** Opens the Create Assignment modal (Step 1 of 5). */
  async clickCreateAssignment() {
    await this.createAssignmentButton.click();
  }
}
