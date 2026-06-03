/**
 * Integration tests for the CSV Import Wizard
 *
 * Covers the full 4-step wizard at /app/:familyId/import-csv:
 *   Step 0 (UploadStep)     — file selection, upload, advance to mapping
 *   Step 1 (MapColumnsStep) — auto-propose mapping, user overrides, run analysis
 *   Step 2 (ReviewStep)     — duplicate pre-skip, include/exclude toggle, edits
 *   Step 3 (ImportStep)     — dispatch + poll job status, success/error screens
 *
 * Plus the entry-point button on TransactionsPage that opens the wizard
 * (hidden for VIEWER role).
 *
 * The wizard depends on:
 *   - POST /imports/upload, /analyze, /execute and GET /imports/jobs/:id
 *     (mocked by handlers in test/mocks/handlers/imports.ts with an
 *     in-memory job store that auto-advances pending -> started -> done).
 *   - GET /accounts and GET /categories used by MapColumnsStep and
 *     ReviewStep (mocked by existing handlers).
 *
 * Tests render the wizard inside a Routes/Route shell so useParams("familyId")
 * resolves. Tests that need a different role re-authenticate the user before
 * rendering (the wrapper's AuthProvider reads the token on mount).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { screen, waitFor, within } from '@testing-library/react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import {
  renderWithProviders,
  setupAuthenticatedUser,
  server,
  createMockAccount,
  createMockExpenseCategory,
} from '@/test/utils';
import {
  resetAccountStore,
  resetCategoryStore,
  resetImportStore,
  seedImportJob,
} from '@/test/mocks/server';
import { ImportCsvPage } from '@/features/transactions/pages/ImportCsvPage';
import { TransactionsPage } from '@/features/transactions/pages';
import { defaultAnalyzeResponse, defaultUploadResponse } from '@/test/mocks/handlers/imports';

const API_BASE = 'http://localhost:8000';
const TENANT_ID = 'tenant-uuid-456';
const IMPORT_ROUTE = `/app/${TENANT_ID}/import-csv`;

/**
 * Helper that builds a CSV File the way a real <input type="file"> would
 * produce one. The wizard sends this as multipart/form-data to /imports/upload.
 */
function buildCsvFile(name: string = 'bank-statement.csv'): File {
  const content = 'Date,Valor,Description\n2025-01-15,-50.00,Supermarket\n';
  return new File([content], name, { type: 'text/csv' });
}

/**
 * Find a MUI Select combobox by its visible InputLabel text.
 *
 * MUI's <Select> + <InputLabel> pair does not produce a proper accessible
 * name on the combobox role in jsdom (no aria-labelledby is generated when
 * no explicit `id`/`labelId` props are passed). Rather than depend on
 * non-semantic data-testids, we locate the wrapping MuiFormControl via the
 * label text and then return the combobox descendant. This keeps the
 * lookup tied to user-visible labels.
 */
function getSelectByLabel(labelText: string | RegExp): HTMLElement {
  // MUI's <InputLabel> often appears twice in the DOM: once as the visible
  // floating label and once inside the fieldset's <legend>. We take the
  // first match — both share the same FormControl ancestor.
  const labels = screen.getAllByText(labelText);
  const formControl = labels[0].closest('.MuiFormControl-root');
  if (!formControl) {
    throw new Error(`Could not find FormControl wrapping label "${labelText}"`);
  }
  const combobox = formControl.querySelector('[role="combobox"]');
  if (!combobox) {
    throw new Error(`No combobox found inside FormControl for "${labelText}"`);
  }
  return combobox as HTMLElement;
}

/**
 * Helper component used by the ImportStep success test. It simply renders
 * the current pathname so tests can assert that the "View Transactions" CTA
 * navigated to the expected URL — useNavigate from react-router-dom changes
 * window history which the MemoryRouter exposes via useLocation.
 */
function CurrentPath() {
  const location = useLocation();
  return <div data-current-path>{location.pathname}</div>;
}

/**
 * Render the wizard inside its own Route definition so useParams resolves.
 * A second Route renders any /app/:familyId/* destination the wizard
 * navigates to so we can verify success-path navigation.
 */
function renderImportWizard() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/import-csv" element={<ImportCsvPage />} />
      <Route path="/app/:familyId/transactions" element={<CurrentPath />} />
    </Routes>,
    { initialEntries: [IMPORT_ROUTE] }
  );
}

/**
 * Render TransactionsPage at the standard route. Used by the entry-point
 * tests to verify the Import CSV button visibility per role.
 */
function renderTransactionsPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/app/:familyId/transactions" element={<TransactionsPage />} />
      <Route path="/app/:familyId/import-csv" element={<CurrentPath />} />
    </Routes>,
    { initialEntries: [`/app/${TENANT_ID}/transactions`] }
  );
}

/**
 * Drive the wizard from the upload step all the way to the review step.
 * Most ReviewStep and ImportStep tests need to start with parsed rows
 * already loaded, so this helper bundles the upload + analyze flow into
 * a single call that returns once the Review table is on screen.
 */
async function advanceWizardToReviewStep(user: ReturnType<typeof userEvent.setup>) {
  // ── Step 0: upload ──
  const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  await user.upload(fileInput, buildCsvFile());

  const uploadButton = await screen.findByRole('button', { name: /^upload$/i });
  await user.click(uploadButton);

  // Wait for MapColumnsStep to render (auto-mapping populates dropdowns)
  const analyzeButton = await screen.findByRole('button', { name: /analyze csv/i });

  // ── Step 1: choose account + analyze ──
  // Open the Account select and pick the seeded account.
  // See getSelectByLabel for why we look up Selects via their visible label.
  const accountCombobox = getSelectByLabel(/^account$/i);
  await user.click(accountCombobox);
  const accountOption = await screen.findByRole('option', { name: /Test Account/i });
  await user.click(accountOption);

  await user.click(analyzeButton);

  // ReviewStep renders the parsed-row summary text once analyze completes
  await waitFor(() => {
    expect(screen.getByText(/of \d+ rows will be imported/i)).toBeInTheDocument();
  });
}

describe('ImportWizard Integration', () => {
  beforeEach(() => {
    // Set up an authenticated non-VIEWER user so /imports/* MSW handlers
    // accept the request and the wizard mounts without redirecting.
    setupAuthenticatedUser(TENANT_ID, 'member');

    // Reset shared stores to known state — each wizard test starts with
    // a single account, a single category, and an empty job store.
    resetAccountStore();
    resetCategoryStore();
    resetImportStore();

    // Override the accounts handler so the MapColumnsStep dropdown has a
    // predictable single option ("Test Account") — the default store returns
    // five accounts which makes the option assertion ambiguous.
    server.use(
      http.get(`${API_BASE}/accounts`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([
          createMockAccount({ id: 'account-uuid-1', name: 'Test Account' }),
        ]);
      }),

      // Pre-populate categories so CategorySelect inside ReviewStep has
      // options the user can pick from.
      http.get(`${API_BASE}/categories`, ({ request }) => {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader) {
          return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 });
        }
        return HttpResponse.json([
          createMockExpenseCategory({ id: 'category-uuid-groceries', name: 'Groceries' }),
        ]);
      })
    );
  });

  // ── Step 0: UploadStep ────────────────────────────────────────────────────

  describe('Step 0 — UploadStep', () => {
    it('disables the Upload button until a file is selected', async () => {
      renderImportWizard();

      const uploadButton = await screen.findByRole('button', { name: /^upload$/i });
      expect(uploadButton).toBeDisabled();
    });

    it('enables Upload after a CSV is selected and advances to step 2 with detected columns', async () => {
      const user = userEvent.setup();
      renderImportWizard();

      // The native file input is hidden behind a styled dropzone — query it
      // by selector since MUI doesn't expose an accessible role for it.
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      expect(fileInput).not.toBeNull();

      await user.upload(fileInput, buildCsvFile());

      // The dropzone now shows the chosen file name and the button enables
      expect(screen.getByText(/bank-statement\.csv/)).toBeInTheDocument();
      const uploadButton = screen.getByRole('button', { name: /^upload$/i });
      expect(uploadButton).toBeEnabled();

      await user.click(uploadButton);

      // After /imports/upload resolves, the wizard advances to MapColumnsStep.
      // MapColumnsStep renders an "Analyze CSV" button — finding it proves
      // we left step 0. The body copy also shifts to the mapping instructions.
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /analyze csv/i })).toBeInTheDocument();
      });
      expect(screen.getByText(/Tell us which CSV column maps to each transaction field/i)).toBeInTheDocument();
    });

    it('shows an error alert when /imports/upload fails', async () => {
      // Override upload to return 413 (file too large) for this test only.
      server.use(
        http.post(`${API_BASE}/imports/upload`, () => {
          return HttpResponse.json({ detail: 'File exceeds 5 MB' }, { status: 413 });
        })
      );

      const user = userEvent.setup();
      renderImportWizard();

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      await user.upload(fileInput, buildCsvFile());
      await user.click(screen.getByRole('button', { name: /^upload$/i }));

      // The wizard stays on step 0 and surfaces the backend error message
      await waitFor(() => {
        expect(screen.getByText(/File exceeds 5 MB/i)).toBeInTheDocument();
      });
      expect(screen.queryByRole('button', { name: /analyze csv/i })).not.toBeInTheDocument();
    });
  });

  // ── Step 1: MapColumnsStep ────────────────────────────────────────────────

  describe('Step 1 — MapColumnsStep', () => {
    it('auto-proposes column mappings based on column names', async () => {
      const user = userEvent.setup();
      renderImportWizard();

      // Walk through upload to land on the mapping step
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      await user.upload(fileInput, buildCsvFile());
      await user.click(screen.getByRole('button', { name: /^upload$/i }));

      // Wait for the mapping step to render
      await screen.findByRole('button', { name: /analyze csv/i });

      // The combobox displays the currently-selected value as its text.
      // Default columns are "Date", "Valor", "Description". The auto-mapper
      // should set:
      //   Date column        -> "Date"        (matches "date" keyword)
      //   Amount column      -> "Valor"       (matches Portuguese amount keyword)
      //   Description column -> "Description" (matches "desc" keyword)
      //
      // We check each combobox's text content rather than its accessible name
      // because MUI Select does not produce an accessible name in jsdom.
      const dateCombobox = getSelectByLabel(/^date column$/i);
      expect(dateCombobox).toHaveTextContent('Date');

      const amountCombobox = getSelectByLabel(/^amount column$/i);
      expect(amountCombobox).toHaveTextContent('Valor');

      // For the (optional) Description column select we verify the hidden
      // native input that MUI maintains alongside the Select — its value
      // reflects the controlled state directly, sidestepping any rendering
      // quirks of the Select's displayed text in jsdom.
      const descriptionLabel = screen.getAllByText(/^description column$/i)[0];
      const descriptionFormControl = descriptionLabel.closest('.MuiFormControl-root')!;
      const descriptionNativeInput = descriptionFormControl.querySelector('input') as HTMLInputElement;
      expect(descriptionNativeInput).not.toBeNull();
      expect(descriptionNativeInput.value).toBe('Description');
    });

    it('lets the user override an auto-proposed mapping via the dropdown', async () => {
      const user = userEvent.setup();
      renderImportWizard();

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      await user.upload(fileInput, buildCsvFile());
      await user.click(screen.getByRole('button', { name: /^upload$/i }));
      await screen.findByRole('button', { name: /analyze csv/i });

      // Override the Date column from auto-proposed "Date" to "Description".
      // This proves the dropdown is interactive and the controlled value updates.
      const dateCombobox = getSelectByLabel(/^date column$/i);
      await user.click(dateCombobox);

      // MUI Select renders a listbox in a portal — scope queries to it so
      // we don't accidentally pick up duplicate text from other selects.
      const listbox = await screen.findByRole('listbox');
      const descriptionOption = within(listbox).getByRole('option', { name: 'Description' });
      await user.click(descriptionOption);

      // The combobox now displays the overridden value
      expect(dateCombobox).toHaveTextContent('Description');
    });

    it('disables Analyze until an account is selected and advances on success', async () => {
      const user = userEvent.setup();
      renderImportWizard();

      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      await user.upload(fileInput, buildCsvFile());
      await user.click(screen.getByRole('button', { name: /^upload$/i }));

      const analyzeButton = await screen.findByRole('button', { name: /analyze csv/i });

      // Account is required and unset by default, so Analyze stays disabled
      expect(analyzeButton).toBeDisabled();

      // Open the account dropdown and pick the seeded account
      const accountCombobox = getSelectByLabel(/^account$/i);
      await user.click(accountCombobox);
      const accountOption = await screen.findByRole('option', { name: /Test Account/i });
      await user.click(accountOption);

      expect(analyzeButton).toBeEnabled();
      await user.click(analyzeButton);

      // Step 2 (Review) now renders the summary line — proves we advanced
      await waitFor(() => {
        expect(screen.getByText(/of \d+ rows will be imported/i)).toBeInTheDocument();
      });
    });

    it('sends the chosen column mapping in the /imports/analyze request', async () => {
      const user = userEvent.setup();

      // Intercept the analyze call so we can inspect the payload the wizard sends.
      let capturedRequestBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${API_BASE}/imports/analyze`, async ({ request }) => {
          capturedRequestBody = await request.json() as Record<string, unknown>;
          return HttpResponse.json(defaultAnalyzeResponse);
        })
      );

      renderImportWizard();
      await advanceWizardToReviewStep(user);

      // The wizard should send the auto-mapped column names plus the chosen
      // account_id and the default currency/start_row values.
      expect(capturedRequestBody).not.toBeNull();
      expect(capturedRequestBody).toMatchObject({
        file_key: defaultUploadResponse.file_key,
        account_id: 'account-uuid-1',
        column_mapping: {
          date_column: 'Date',
          amount_column: 'Valor',
          description_column: 'Description',
        },
        currency: 'BRL',
        start_row: 0,
      });
    });

    it('defaults the "Use positive values as expenses" checkbox on for a credit account and sends the flag', async () => {
      const user = userEvent.setup();

      // Credit-card statements use the inverted sign convention, so selecting a
      // credit account must pre-check the classification box and send the flag.
      server.use(
        http.get(`${API_BASE}/accounts`, () =>
          HttpResponse.json([
            createMockAccount({ id: 'account-credit-1', name: 'My Credit Card', type: 'credit' }),
          ])
        )
      );

      let capturedRequestBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${API_BASE}/imports/analyze`, async ({ request }) => {
          capturedRequestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(defaultAnalyzeResponse);
        })
      );

      renderImportWizard();

      // Upload and land on the mapping step
      const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]')!;
      await user.upload(fileInput, buildCsvFile());
      await user.click(screen.getByRole('button', { name: /^upload$/i }));
      const analyzeButton = await screen.findByRole('button', { name: /analyze csv/i });

      // Selecting the credit account should flip the checkbox on automatically
      const accountCombobox = getSelectByLabel(/^account$/i);
      await user.click(accountCombobox);
      await user.click(await screen.findByRole('option', { name: /My Credit Card/i }));

      const classificationCheckbox = screen.getByRole('checkbox', {
        name: /use positive values as expenses/i,
      });
      await waitFor(() => expect(classificationCheckbox).toBeChecked());

      // The flag must be carried into the analyze request payload
      await user.click(analyzeButton);
      await waitFor(() => {
        expect(screen.getByText(/of \d+ rows will be imported/i)).toBeInTheDocument();
      });
      expect(capturedRequestBody).toMatchObject({
        account_id: 'account-credit-1',
        positive_amounts_are_expenses: true,
      });
    });

    it('leaves the classification checkbox off for a debit account and sends the flag as false', async () => {
      const user = userEvent.setup();

      // The seeded "Test Account" is a debit account (the bank convention), so
      // the box stays unchecked and the flag is sent false.
      let capturedRequestBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${API_BASE}/imports/analyze`, async ({ request }) => {
          capturedRequestBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(defaultAnalyzeResponse);
        })
      );

      renderImportWizard();
      await advanceWizardToReviewStep(user);

      expect(capturedRequestBody).toMatchObject({
        account_id: 'account-uuid-1',
        positive_amounts_are_expenses: false,
      });
    });
  });

  // ── Step 2: ReviewStep ────────────────────────────────────────────────────

  describe('Step 2 — ReviewStep', () => {
    it('pre-checks duplicate rows as skipped', async () => {
      const user = userEvent.setup();
      renderImportWizard();
      await advanceWizardToReviewStep(user);

      // The default analyze response contains 3 rows: 1 unique, 1 duplicate,
      // 1 parse error. The summary at the top of the step reflects that the
      // unique row is the only one selected for import by default.
      expect(screen.getByText(/^1 of 3 rows will be imported$/i)).toBeInTheDocument();

      // The duplicate row gets a "Duplicate" chip; the parse-error row gets
      // an "Error" chip. Both are surfaced visually in the status column.
      expect(screen.getByText('Duplicate')).toBeInTheDocument();
      expect(screen.getByText('Error')).toBeInTheDocument();

      // The header summary chips reflect the same counts
      expect(screen.getByText(/1 duplicates pre-skipped/i)).toBeInTheDocument();
      expect(screen.getByText(/1 parse errors/i)).toBeInTheDocument();
    });

    it('includes a duplicate row when the user unchecks its skip flag', async () => {
      const user = userEvent.setup();
      renderImportWizard();
      await advanceWizardToReviewStep(user);

      // The duplicate row's description ("Coffee shop") is rendered as the
      // VALUE of an editable TextField, not as visible text — so we locate
      // it via getByDisplayValue and walk up to the containing <tr>.
      const duplicateDescriptionInput = screen.getByDisplayValue('Coffee shop');
      const duplicateRow = duplicateDescriptionInput.closest('[role="row"]')!;
      const duplicateCheckbox = within(duplicateRow).getByRole('checkbox');
      expect(duplicateCheckbox).not.toBeChecked();

      await user.click(duplicateCheckbox);

      // Now the duplicate is included, so the import count goes from 1 to 2
      await waitFor(() => {
        expect(screen.getByText(/^2 of 3 rows will be imported$/i)).toBeInTheDocument();
      });

      // The bottom Import button reflects the new included count
      expect(
        screen.getByRole('button', { name: /^import 2 transactions$/i })
      ).toBeInTheDocument();
    });

    it('allows editing the description of a non-skipped row', async () => {
      const user = userEvent.setup();
      renderImportWizard();
      await advanceWizardToReviewStep(user);

      // Locate the unique row by its initial description value, then
      // overwrite the value through the editable TextField.
      const descriptionInput = screen.getByDisplayValue('Supermarket') as HTMLInputElement;

      await user.clear(descriptionInput);
      await user.type(descriptionInput, 'Whole Foods Market');

      // The edit is reflected immediately in the controlled input value
      expect(screen.getByDisplayValue('Whole Foods Market')).toBeInTheDocument();
    });

    it('shows the correct count in the bottom Import button (excludes errors and skipped rows)', async () => {
      const user = userEvent.setup();
      renderImportWizard();
      await advanceWizardToReviewStep(user);

      // Default state: only the unique row (1 of 3) is queued for import.
      // The parse-error row is excluded and the duplicate row is pre-skipped.
      expect(
        screen.getByRole('button', { name: /^import 1 transaction$/i })
      ).toBeInTheDocument();
    });

    it('disables the Import button when every row is skipped', async () => {
      const user = userEvent.setup();
      renderImportWizard();
      await advanceWizardToReviewStep(user);

      // Uncheck the only included row (Supermarket) so nothing is left to import.
      // We find the row via its TextField display value (description is editable).
      const supermarketInput = screen.getByDisplayValue('Supermarket');
      const uniqueRow = supermarketInput.closest('[role="row"]')!;
      const uniqueRowCheckbox = within(uniqueRow).getByRole('checkbox');
      expect(uniqueRowCheckbox).toBeChecked();
      await user.click(uniqueRowCheckbox);

      // The bottom Import button shows "0 transactions" and is disabled
      await waitFor(() => {
        const zeroButton = screen.getByRole('button', { name: /^import 0 transactions$/i });
        expect(zeroButton).toBeDisabled();
      });
    });
  });

  // ── Step 3: ImportStep ────────────────────────────────────────────────────

  describe('Step 3 — ImportStep', () => {
    it('dispatches POST /imports/execute on mount and shows progress while pending', async () => {
      const user = userEvent.setup();

      // Track execute calls — we want to assert exactly one dispatch
      let executeCallCount = 0;
      server.use(
        http.post(`${API_BASE}/imports/execute`, async ({ request }) => {
          executeCallCount += 1;
          await request.json();
          // Seed a job that stays pending so the progress UI stays visible
          seedImportJob('pending-job', { status: 'pending', total: 1 });
          return HttpResponse.json({ job_id: 'pending-job' });
        })
      );

      renderImportWizard();
      await advanceWizardToReviewStep(user);

      // Click the bottom Import button to enter ImportStep
      await user.click(screen.getByRole('button', { name: /^import 1 transaction$/i }));

      // The "Queuing import…" or "Importing transactions…" headline appears
      // while the job is pending/started — wait for either.
      await waitFor(() => {
        const queuing = screen.queryByText(/queuing import/i);
        const importing = screen.queryByText(/importing transactions/i);
        expect(queuing || importing).toBeTruthy();
      });

      expect(executeCallCount).toBe(1);
    });

    it('shows the success screen with a View Transactions link when the job finishes', async () => {
      const user = userEvent.setup();

      // Pre-seed the dispatched job to a "done" status so the polling hook
      // resolves on its first call without waiting for the 2s interval.
      server.use(
        http.post(`${API_BASE}/imports/execute`, async ({ request }) => {
          await request.json();
          seedImportJob('done-job', { status: 'done', imported: 1, total: 1 });
          return HttpResponse.json({ job_id: 'done-job' });
        })
      );

      renderImportWizard();
      await advanceWizardToReviewStep(user);
      await user.click(screen.getByRole('button', { name: /^import 1 transaction$/i }));

      // Success state: headline + count + CTA
      await waitFor(() => {
        expect(screen.getByText(/import complete/i)).toBeInTheDocument();
      });
      expect(screen.getByText(/1 transaction imported successfully/i)).toBeInTheDocument();

      // Click "View Transactions" — should navigate to /app/:familyId/transactions.
      // The CurrentPath route renders the pathname so we can assert on it.
      const viewLink = screen.getByRole('button', { name: /view transactions/i });
      await user.click(viewLink);

      await waitFor(() => {
        const pathElement = document.querySelector('[data-current-path]');
        expect(pathElement?.textContent).toBe(`/app/${TENANT_ID}/transactions`);
      });
    });

    it('shows an error alert when the job status comes back as failed', async () => {
      const user = userEvent.setup();

      server.use(
        http.post(`${API_BASE}/imports/execute`, async ({ request }) => {
          await request.json();
          seedImportJob('failed-job', {
            status: 'failed',
            error: 'Database insert failed: constraint violation',
          });
          return HttpResponse.json({ job_id: 'failed-job' });
        })
      );

      renderImportWizard();
      await advanceWizardToReviewStep(user);
      await user.click(screen.getByRole('button', { name: /^import 1 transaction$/i }));

      // Failure state: surfaces the backend error message and offers Start Over
      await waitFor(() => {
        expect(
          screen.getByText(/Database insert failed: constraint violation/i)
        ).toBeInTheDocument();
      });
      expect(screen.getByRole('button', { name: /start over/i })).toBeInTheDocument();
    });

    it('shows an error when the execute dispatch itself fails', async () => {
      const user = userEvent.setup();

      server.use(
        http.post(`${API_BASE}/imports/execute`, () => {
          return HttpResponse.json(
            { detail: 'Account does not belong to this tenant' },
            { status: 403 }
          );
        })
      );

      renderImportWizard();
      await advanceWizardToReviewStep(user);
      await user.click(screen.getByRole('button', { name: /^import 1 transaction$/i }));

      // The dispatch error is captured and rendered in an Alert
      await waitFor(() => {
        expect(
          screen.getByText(/Account does not belong to this tenant/i)
        ).toBeInTheDocument();
      });
    });
  });
});

// ── Entry point on TransactionsPage ─────────────────────────────────────────

describe('TransactionsPage — Import CSV entry point', () => {
  beforeEach(() => {
    resetAccountStore();
    resetCategoryStore();
    resetImportStore();
  });

  it('shows an Import CSV button for non-VIEWER roles that navigates to the wizard', async () => {
    setupAuthenticatedUser(TENANT_ID, 'member');
    const user = userEvent.setup();

    renderTransactionsPage();

    // The button uses an outlined variant and an upload icon; queryByRole
    // matches the accessible name regardless of styling.
    const importButton = await screen.findByRole('button', { name: /import csv/i });
    expect(importButton).toBeInTheDocument();

    await user.click(importButton);

    // The wizard route renders CurrentPath which echoes the pathname
    await waitFor(() => {
      const pathElement = document.querySelector('[data-current-path]');
      expect(pathElement?.textContent).toBe(`/app/${TENANT_ID}/import-csv`);
    });
  });

  it('hides the Import CSV button when the current user role is viewer', async () => {
    // Re-authenticate as a viewer before rendering — AuthProvider reads the
    // token on mount, so the role must be set before the page renders.
    setupAuthenticatedUser(TENANT_ID, 'viewer');

    renderTransactionsPage();

    // Page heading still appears so we know the page rendered, but no
    // write actions (Import CSV, Add Transaction) are visible.
    expect(await screen.findByRole('heading', { name: /transactions/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import csv/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add transaction/i })).not.toBeInTheDocument();
  });
});
