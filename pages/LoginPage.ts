import { Page, Locator, expect } from '@playwright/test';

/**
 * Represents the Newsela sign-in page (app.newsela.com/signin).
 * Reaching a protected Everwrite/Writing URL while logged out redirects here.
 */
export class LoginPage {
  readonly page: Page;
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly signInButton: Locator;
  readonly forgotPasswordLink: Locator;

  // Cookie consent banner ("Your Privacy Choices") shown to first-time
  // visitors - Playwright always starts from a clean browser profile, so
  // this appears on every run even though it's easy to miss when exploring
  // manually in a browser that already has a consent decision saved.
  //
  // Deliberately NOT scoped inside a `getByRole('dialog', { name: ... })`
  // locator: the widget's on-screen heading ("Your Privacy Choices") is not
  // reliably wired up as the dialog element's own accessible name (no
  // aria-labelledby), so a name-scoped dialog locator can silently match
  // zero elements and make this a no-op. Targeting the "Close" button
  // directly is more robust since it's the only one on the page at login.
  readonly cookieConsentCloseButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // Required fields on this form get their accessible name suffixed with
    // "Required" (e.g. "Password Required", from the visible "*" marker), so
    // an exact match on the bare label fails. A loose (substring) match on
    // "Password" is also unsafe here: the adjacent "Show Password" toggle
    // button's aria-label contains "Password" too, so `getByLabel('Password')`
    // resolves to both the input AND the button (Playwright strict-mode
    // violation). Matching the full "<Field> Required" name via getByRole
    // pins it to exactly the textbox.
    this.usernameInput = page.getByRole('textbox', { name: 'Username Required' });
    this.passwordInput = page.getByRole('textbox', { name: 'Password Required' });
    this.signInButton = page.getByRole('button', { name: 'Sign in', exact: true });
    this.forgotPasswordLink = page.getByRole('link', { name: 'Forgot password' });

    this.cookieConsentCloseButton = page.getByRole('button', { name: 'Close', exact: true });
  }

  /** Navigate to the app entry point; unauthenticated sessions land on this sign-in page. */
  async goto(path: string = '/') {
    await this.page.goto(path);
    // Give the page's JS bundle time to finish loading and attach its event
    // handlers before we touch anything. On a completely cold Playwright
    // profile (no cached chunks, unlike a normal warmed-up browser) the
    // sign-in button's real click handler was observed to not be attached
    // yet even after the form is visible and fillable - clicking it then
    // falls through to the browser's default native HTML form submission
    // (method="get"), sending the username/password as plaintext URL query
    // params instead of going through the app's real AJAX sign-in flow. See
    // the note on `login()` below for how that's additionally guarded against.
    await this.page.waitForLoadState('networkidle').catch(() => {
      // Some background polling can keep the network from ever going fully
      // idle; don't let that block the whole test if the form is otherwise
      // usable.
    });
  }

  /**
   * Dismisses the cookie consent banner if it appears, without accepting
   * non-essential cookies (closing the banner is the most privacy-preserving
   * option available on it - it does not opt in to tracking/analytics).
   * No-ops silently if the banner never shows up (e.g. a persisted profile).
   */
  async dismissCookieBannerIfPresent() {
    try {
      await this.cookieConsentCloseButton.click({ timeout: 5_000 });
    } catch {
      // Banner didn't appear within the timeout - nothing to dismiss.
    }
  }

  /** Waits until the sign-in form is visible, useful when arriving here via a redirect. */
  async waitUntilLoaded() {
    await this.dismissCookieBannerIfPresent();
    await expect(this.usernameInput).toBeVisible();
    await expect(this.passwordInput).toBeVisible();
  }

  /**
   * Fills the sign-in form and submits it, retrying once if the app's real
   * sign-in handler wasn't attached in time (see the note on `goto()`).
   *
   * That failure mode is unambiguous to detect: the browser ends up back on
   * `/signin/` with `username`/`password` in the query string instead of
   * navigating to `/assignments`. This is also flagged in TEST_PLAN.md as a
   * genuine finding worth a manual/security follow-up independent of this
   * automation workaround - a real form should never be able to fall back to
   * submitting credentials as a plaintext GET request.
   */
  async login(username: string, password: string) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      await this.usernameInput.click();
      await this.usernameInput.fill('');
      await this.usernameInput.pressSequentially(username, { delay: 20 });
      await this.passwordInput.click();
      await this.passwordInput.fill('');
      await this.passwordInput.pressSequentially(password, { delay: 20 });
      await expect(this.signInButton).toBeEnabled();
      await this.signInButton.click();

      const fellBackToGetSubmit = await this.page
        .waitForURL(/\/signin\/\?.*username=/, { timeout: 3_000 })
        .then(() => true)
        .catch(() => false);

      if (!fellBackToGetSubmit) {
        // Either it's already navigated away from /signin, or it's still
        // mid-navigation - either way, let the caller's own wait (e.g.
        // AssignmentsPage.waitUntilLoaded) confirm where it lands.
        return;
      }

      if (attempt === 2) {
        throw new Error(
          'Sign-in form fell back to a native GET submission (credentials leaked into the ' +
            'URL) on both attempts - this looks like a real app bug, not just automation flake.'
        );
      }

      // Re-navigate to a clean sign-in page (clearing the leaked credentials
      // from the URL) and let the extra load settle before retrying.
      await this.goto('/');
      await this.dismissCookieBannerIfPresent();
    }
  }
}
