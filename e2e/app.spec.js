import { test, expect } from '@playwright/test'

const PASSPHRASE = 'TestPassphrase123!'

async function freshStart(page) {
  await page.goto('/')
  await page.evaluate(async () => {
    const dbs = await indexedDB.databases()
    for (const db of dbs) indexedDB.deleteDatabase(db.name)
  })
  await page.reload()
  await page.waitForLoadState('networkidle')
}

async function setupVault(page) {
  await freshStart(page)
  await expect(page.locator('#passphrase')).toBeVisible()
  await page.locator('#passphrase').fill(PASSPHRASE)
  await page.locator('#confirm').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Create Vault' }).click()
  await expect(page.getByText('Total Applications')).toBeVisible()
}

async function unlock(page) {
  await expect(page.locator('#passphrase')).toBeVisible()
  await page.locator('#passphrase').fill(PASSPHRASE)
  await page.getByRole('button', { name: 'Unlock' }).click()
  await expect(page.getByText('Total Applications')).toBeVisible()
}

async function createApp(page, { company, role, status, source } = {}) {
  await page.getByRole('button', { name: 'Applications' }).click()
  await page.getByRole('button', { name: '+ Add' }).click()
  await page.waitForTimeout(200)
  // Company and Role are the two required inputs in the drawer
  const drawer = page.locator('[style*="position: fixed"]')
  await drawer.locator('input[required]').first().fill(company || 'TestCorp')
  await drawer.locator('input[required]').nth(1).fill(role || 'Engineer')
  if (status) await drawer.locator('form select').first().selectOption(status)
  if (source) {
    // Source is the select after Status and DateApplied
    const sourceSelect = drawer.locator('form select').nth(1)
    await sourceSelect.selectOption(source)
  }
  await drawer.getByRole('button', { name: 'Save' }).click()
  await page.waitForTimeout(300)
}

test.describe('First-run setup', () => {
  test('shows passphrase setup screen and unlocks to empty dashboard', async ({ page }) => {
    await freshStart(page)
    // Verify setup screen elements
    await expect(page.locator('#passphrase')).toBeVisible()
    await expect(page.locator('#confirm')).toBeVisible()
    await expect(page.getByText('No recovery possible')).toBeVisible()

    await page.locator('#passphrase').fill(PASSPHRASE)
    await page.locator('#confirm').fill(PASSPHRASE)
    await page.getByRole('button', { name: 'Create Vault' }).click()

    await expect(page.getByText('Total Applications')).toBeVisible()
    await expect(page.getByText('No applications yet')).toBeVisible()
  })

  test('rejects short passphrase', async ({ page }) => {
    await freshStart(page)
    await page.locator('#passphrase').fill('short')
    await page.locator('#confirm').fill('short')
    await page.getByRole('button', { name: 'Create Vault' }).click()
    await expect(page.getByText('Minimum 8 characters')).toBeVisible()
  })
})

test.describe('Lock/unlock cycle', () => {
  test('data persists after lock and correct unlock', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'PersistCo', role: 'SDE' })
    await expect(page.getByText('PersistCo')).toBeVisible()

    await page.getByRole('button', { name: '🔒' }).click()
    await expect(page.locator('#passphrase')).toBeVisible()
    await unlock(page)

    await page.getByRole('button', { name: 'Applications' }).click()
    await expect(page.getByText('PersistCo')).toBeVisible()
  })

  test('wrong passphrase shows error, no data leak', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'SecretCo', role: 'Eng' })

    await page.getByRole('button', { name: '🔒' }).click()
    await page.locator('#passphrase').fill('WrongPassword123')
    await page.getByRole('button', { name: 'Unlock' }).click()
    await expect(page.getByText('Wrong passphrase')).toBeVisible()
    await expect(page.getByText('SecretCo')).not.toBeVisible()
  })

  test('data persists across page reload', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'ReloadCo', role: 'PM' })

    await page.reload()
    await unlock(page)
    await page.getByRole('button', { name: 'Applications' }).click()
    await expect(page.getByText('ReloadCo')).toBeVisible()
  })
})

test.describe('Application CRUD', () => {
  test('create, edit, delete application', async ({ page }) => {
    await setupVault(page)

    await page.getByRole('button', { name: 'Applications' }).click()
    await page.getByRole('button', { name: '+ Add' }).click()
    const drawer = page.locator('[style*="position: fixed"]')
    await drawer.locator('input[required]').first().fill('CRUDCorp')
    await drawer.locator('input[required]').nth(1).fill('Staff Engineer')
    await drawer.locator('textarea').fill('Test notes here')
    await drawer.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('CRUDCorp')).toBeVisible()

    // Edit
    await page.getByText('CRUDCorp').click()
    const editDrawer = page.locator('[style*="position: fixed"]')
    await editDrawer.locator('input[required]').nth(1).fill('Principal Engineer')
    await editDrawer.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Principal Engineer')).toBeVisible()

    // Verify persists
    await page.reload()
    await unlock(page)
    await page.getByRole('button', { name: 'Applications' }).click()
    await expect(page.getByText('Principal Engineer')).toBeVisible()

    // Delete
    await page.getByText('CRUDCorp').click()
    page.on('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForTimeout(300)
    await expect(page.getByText('CRUDCorp')).not.toBeVisible()
  })
})

test.describe('Status transitions', () => {
  test('status changes append to statusHistory with notes', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'StatusCo', role: 'SDE', status: 'Applied' })

    await page.getByRole('button', { name: 'Applications' }).click()
    await page.getByText('StatusCo').click()

    const drawer = page.locator('[style*="position: fixed"]')

    // The "Change Status" section has a select with "— Select new status —"
    const changeSelect = drawer.locator('select').filter({ hasText: 'Select new status' })

    // Transition 1
    await changeSelect.selectOption('Recruiter Screen Scheduled')
    await drawer.getByPlaceholder('Note (optional)').fill('Recruiter reached out')
    await drawer.getByRole('button', { name: 'Confirm Status Change' }).click()

    // Transition 2
    await changeSelect.selectOption('Interview Scheduled')
    await drawer.getByPlaceholder('Note (optional)').fill('Phone screen passed')
    await drawer.getByRole('button', { name: 'Confirm Status Change' }).click()

    // Transition 3
    await changeSelect.selectOption('Offer')
    await drawer.getByPlaceholder('Note (optional)').fill('Got the offer!')
    await drawer.getByRole('button', { name: 'Confirm Status Change' }).click()

    await drawer.getByRole('button', { name: 'Save' }).click()

    // Reopen and verify history
    await page.getByText('StatusCo').click()
    await expect(page.getByText('Recruiter reached out')).toBeVisible()
    await expect(page.getByText('Phone screen passed')).toBeVisible()
    await expect(page.getByText('Got the offer!')).toBeVisible()
  })
})

test.describe('Resume upload and link', () => {
  test('upload PDF, tag, link to application, verify after reload', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'ResumeCo', role: 'PM' })

    await page.getByRole('button', { name: 'Resumes' }).click()
    await page.getByRole('button', { name: '+ Upload' }).click()

    // Version name input is the text input in the upload form
    await page.locator('form').filter({ hasText: 'Version Name' }).locator('input[type="text"]').fill('PM-v2-Leadership')

    const pdfContent = '%PDF-1.0\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n'
    await page.locator('input[type="file"]').setInputFiles({
      name: 'test-resume.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfContent)
    })
    await page.locator('form').filter({ hasText: 'Version Name' }).getByRole('button', { name: 'Upload' }).click()
    await expect(page.getByText('PM-v2-Leadership')).toBeVisible()

    // Link to application
    await page.getByRole('button', { name: '🔗' }).click()
    await page.getByText('ResumeCo — PM').click()
    await expect(page.getByText('Linked to: ResumeCo')).toBeVisible()

    // Reload and verify
    await page.reload()
    await unlock(page)
    await page.getByRole('button', { name: 'Resumes' }).click()
    await expect(page.getByText('PM-v2-Leadership')).toBeVisible()
  })
})

test.describe('Prep guide and retrospective flow', () => {
  test('create linked prep guide, interview round, and retrospective', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'PrepCo', role: 'TPM' })

    // Prep guide
    await page.getByRole('button', { name: 'Prep Library' }).click()
    await page.getByRole('button', { name: '+ New Guide' }).click()
    await page.getByLabel('Linked Application').selectOption({ label: 'PrepCo — TPM' })
    await page.getByLabel('Company Research').fill('Series B startup, 200 employees')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('PrepCo — TPM')).toBeVisible()

    // Interview round
    await page.getByRole('button', { name: 'Retrospectives' }).click()
    await page.getByRole('button', { name: '+ Add Round' }).click()
    await page.getByLabel('Application').selectOption({ label: 'PrepCo — TPM' })
    await page.getByLabel('Type').selectOption('technical')
    await page.getByLabel('Interviewer Names/Roles').fill('Jane (Sr Eng)')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('technical')).toBeVisible()

    // Retrospective
    await page.getByRole('button', { name: /Retro/ }).first().click()
    await page.getByLabel('What went well').fill('Good system design discussion')
    await page.getByLabel('What went poorly').fill('Rushed coding')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Good system design')).toBeVisible()

    // Reload and verify
    await page.reload()
    await unlock(page)
    await page.getByRole('button', { name: 'Retrospectives' }).click()
    await expect(page.getByText('Good system design')).toBeVisible()
  })
})

test.describe('Dashboard math', () => {
  test('funnel counts match seeded data', async ({ page }) => {
    await setupVault(page)

    await createApp(page, { company: 'Co1', role: 'E1', status: 'Applied' })
    await createApp(page, { company: 'Co2', role: 'E2', status: 'Applied' })
    await createApp(page, { company: 'Co3', role: 'E3', status: 'Interview Scheduled' })
    await createApp(page, { company: 'Co4', role: 'E4', status: 'Offer' })
    await createApp(page, { company: 'Co5', role: 'E5', status: 'Rejected' })

    await page.getByRole('button', { name: 'Dashboard' }).click()
    await expect(page.locator('.card').filter({ hasText: 'Total Applications' })).toContainText('5')
    await expect(page.getByText('Pipeline Funnel')).toBeVisible()
  })
})

test.describe('Export/import round trip', () => {
  test('export, clear, import restores all data', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'ExportCo', role: 'SDE' })
    await page.getByRole('button', { name: 'Applications' }).click()
    await expect(page.getByText('ExportCo')).toBeVisible()

    // Export
    await page.getByRole('button', { name: '💾' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Backup' }).click()
    ])
    const filePath = await download.path()

    // Clear and re-setup
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      for (const db of dbs) indexedDB.deleteDatabase(db.name)
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.locator('#passphrase').fill(PASSPHRASE)
    await page.locator('#confirm').fill(PASSPHRASE)
    await page.getByRole('button', { name: 'Create Vault' }).click()
    await expect(page.getByText('Total Applications')).toBeVisible()

    // Import
    await page.getByRole('button', { name: '💾' }).click()
    await page.locator('input[type="file"]').setInputFiles(filePath)
    await expect(page.getByText('Import complete')).toBeVisible()

    // Verify
    await page.getByRole('button', { name: 'Applications' }).click()
    await expect(page.getByText('ExportCo')).toBeVisible()
  })
})

test.describe('Wrong-passphrase import', () => {
  test('data encrypted with different passphrase is not readable', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'SafeCo', role: 'Eng' })

    // Export
    await page.getByRole('button', { name: '💾' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export Backup' }).click()
    ])
    const filePath = await download.path()

    // Clear and setup with different passphrase
    await page.evaluate(async () => {
      const dbs = await indexedDB.databases()
      for (const db of dbs) indexedDB.deleteDatabase(db.name)
    })
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.locator('#passphrase').fill('DifferentPass123!')
    await page.locator('#confirm').fill('DifferentPass123!')
    await page.getByRole('button', { name: 'Create Vault' }).click()
    await expect(page.getByText('Total Applications')).toBeVisible()

    // Import backup encrypted with original passphrase
    await page.getByRole('button', { name: '💾' }).click()
    await page.locator('input[type="file"]').setInputFiles(filePath)

    // Data won't decrypt with wrong key
    await page.getByRole('button', { name: 'Applications' }).click()
    await expect(page.getByText('SafeCo')).not.toBeVisible()
  })
})

test.describe('Dark mode toggle', () => {
  test('toggle persists across reload', async ({ page }) => {
    await setupVault(page)
    await page.getByRole('button', { name: '🌙' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test.describe('Ghosted detection', () => {
  test('application triggers ghosted banner when threshold is lowered', async ({ page }) => {
    await setupVault(page)
    await createApp(page, { company: 'GhostCo', role: 'SDE', status: 'Applied' })

    // Set threshold to 0 via localStorage so freshly-created app triggers it
    await page.evaluate(() => localStorage.setItem('ghostedDays', '0'))
    await page.getByRole('button', { name: 'Dashboard' }).click()

    // Reload to pick up the localStorage change
    await page.reload()
    await unlock(page)

    await expect(page.getByText('GhostCo')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mark Ghosted' })).toBeVisible()
  })
})
