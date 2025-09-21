# TSA Parent Assistant - Production Test Plan

## Philosophy (Larson Style)
- Test what users actually do, not what they might do
- Test the money path first
- If it passes these tests, you keep your job

## 1. Critical Path Tests (If these fail, you're fired)

### Parent Flow - "Can parents get answers?"
```bash
# Run: bun test:parent-flow
```

Test these EXACT questions (from real parents):
1. "When does spring registration open?" → Must return Jan 5, 2025
2. "How much does it cost?" → Must mention $200/month
3. "What's the phone number?" → Must show (512) 555-0199
4. "When is practice for 7 year olds?" → Must show Mon/Wed 4-6pm
5. "Can I pay with credit card?" → Must mention payment options

**Pass Criteria**: 4/5 correct answers

### Admin Flow - "Can admins fix bad answers?"
```bash
# Run: bun run test:admin-flow
```

1. Login with password
2. See a bad Q&A pair
3. Delete it
4. Add correct one
5. Verify parent sees new answer

**Pass Criteria**: All steps work

### Error Resilience - "$100 Bug Bounty Test"
```bash
# Run: bun run test:resilience
```

1. Kill the OpenAI API → App shows fallback, doesn't crash
2. Upload 100MB file → Rejects gracefully
3. Ask 1000 char question → Handles it
4. Spam 50 requests → Rate limits work
5. Wrong admin password 10x → Doesn't leak info

**Pass Criteria**: No crashes, no 500 errors

## 2. Business Value Tests (If these fail, you're in trouble)

### RAG Quality - "Are answers actually good?"
```bash
# Run: bun run test:rag-quality
```

Test with 20 real parent questions:
- Accuracy: 80%+ correct
- Hallucination: 0 made-up info
- Relevance: Answer matches question

### Document Processing - "Can we handle real docs?"
```bash
# Run: bun run test:documents
```

1. Upload parent handbook (PDF)
2. Upload coach guide (DOCX)  
3. Upload meeting audio (MP3)
4. Search for content from each
5. Get correct answers

**Pass Criteria**: All formats work, content searchable

### Feedback Loop - "Does thumbs down actually help?"
```bash
# Run: bun run test:feedback
```

1. Parent gives thumbs down
2. Admin sees it in "Check Issues"
3. Admin fixes it
4. Parent asks again → Gets good answer

**Pass Criteria**: Full loop works

## 3. Edge Cases (If these fail, it's embarrassing but survivable)

### Mobile Experience
- Share button works on iPhone/Android
- UI is usable on small screens
- No horizontal scroll

### Performance
- First question < 3s response
- Search results < 1s
- Admin panel loads < 2s

### Security
- Can't access admin without password
- Can't SQL inject Q&A pairs
- Can't XSS in questions

## Test Implementation

```typescript
// tests/critical-path.test.ts
import { test, expect } from '@playwright/test';

test.describe('Parent Flow - Job Critical', () => {
  test('Spring registration question', async ({ page }) => {
    await page.goto('/');
    await page.fill('input', 'When does spring registration open?');
    await page.press('input', 'Enter');
    
    const answer = await page.waitForSelector('.answer-content');
    const text = await answer.textContent();
    
    expect(text).toContain('January 5, 2025');
    expect(text).toContain('9:00 AM');
  });

  test('Handles no answer gracefully', async ({ page }) => {
    await page.goto('/');
    await page.fill('input', 'What is the meaning of life?');
    await page.press('input', 'Enter');
    
    const answer = await page.waitForSelector('.answer-content');
    const text = await answer.textContent();
    
    expect(text).toContain('(512) 555-0199');
    expect(text).not.toContain('Error');
  });
});

test.describe('Admin Flow - Job Critical', () => {
  test('Can fix bad answers', async ({ page }) => {
    // Login
    await page.goto('/admin');
    await page.fill('input[type="password"]', process.env.ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    
    // Check issues
    await page.click('text=Q&A Pairs');
    await page.click('text=Check Issues');
    
    // Delete bad Q&A
    const firstIssue = page.locator('.qa-row').first();
    await firstIssue.click('button:has-text("Delete")');
    
    // Add correct one
    await page.click('text=Add Q&A');
    await page.fill('input[name="question"]', 'What are practice times?');
    await page.fill('textarea[name="answer"]', 'Beginners: Mon/Wed 4-6pm...');
    await page.click('button:has-text("Save")');
    
    // Verify
    await page.goto('/');
    await page.fill('input', 'What are practice times?');
    await page.press('input', 'Enter');
    
    const answer = await page.waitForSelector('.answer-content');
    expect(await answer.textContent()).toContain('Mon/Wed 4-6pm');
  });
});

test.describe('Resilience - $100 Bounty', () => {
  test('Survives API failure', async ({ page }) => {
    // Mock API failure
    await page.route('**/api/q', route => route.abort());
    
    await page.goto('/');
    await page.fill('input', 'Test question');
    await page.press('input', 'Enter');
    
    // Should show error state, not crash
    await expect(page.locator('text=Something went wrong')).toBeVisible();
    await expect(page.locator('text=Refresh page')).toBeVisible();
  });
});
```

## Running the Tests

```bash
# Quick smoke test (5 min)
bun run test:smoke

# Full test suite (30 min)  
bun run test:all

# Generate report for boss
bun run test:report
```

## Test Report Template

```markdown
# TSA Parent Assistant - Test Results

Date: [DATE]
Tester: [NAME]
Environment: Production (Vercel)

## Summary
- ✅ All critical paths passed
- ✅ 0 crashes or 500 errors
- ✅ Parents can get answers
- ✅ Admins can manage content

## Critical Path Results

### Parent Flow (5/5) ✅
- [✓] Spring registration: Correct date returned
- [✓] Pricing info: $200/month displayed
- [✓] Contact info: Phone number shown
- [✓] Schedule lookup: Correct times
- [✓] Payment methods: All options listed

### Admin Flow (5/5) ✅  
- [✓] Login works
- [✓] Can view Q&A pairs
- [✓] Can delete bad answers
- [✓] Can add new answers
- [✓] Changes reflect for parents

### Error Resilience (5/5) ✅
- [✓] API failure: Shows fallback
- [✓] Large file: Rejected gracefully
- [✓] Long question: Handled
- [✓] Spam protection: Rate limited
- [✓] Bad password: No info leaked

## Quality Metrics
- Answer Accuracy: 85% (17/20 correct)
- Response Time: Avg 1.8s
- Error Rate: 0%
- Mobile Usable: Yes

## Recommendation
**READY FOR PRODUCTION** ✅

No blocking issues found. System meets all requirements.
```

## Automation Setup

```json
// package.json
{
  "scripts": {
    "test:smoke": "playwright test tests/smoke.test.ts",
    "test:parent-flow": "playwright test tests/critical-path.test.ts -g 'Parent Flow'",
    "test:admin-flow": "playwright test tests/critical-path.test.ts -g 'Admin Flow'",
    "test:resilience": "playwright test tests/resilience.test.ts",
    "test:all": "playwright test",
    "test:report": "playwright test --reporter=html && open playwright-report/index.html"
  }
}
```

## Why This Guarantees Your Job

1. **Tests what the boss cares about** - Parents getting answers
2. **Proves resilience** - No $100 bug bounties  
3. **Shows professionalism** - Automated, repeatable, reportable
4. **Focuses on outcomes** - Not implementation details
5. **Simple to run** - `bun run test:all` → Keep job

## Larson's Wisdom

"Test the behavior users depend on, not the implementation you're proud of."

These tests are:
- **Behavior-focused**: What users actually do
- **Outcome-oriented**: Business value, not code coverage  
- **Maintainable**: Change implementation, tests still pass
- **Debuggable**: When they fail, you know why
- **Fast enough**: 30 min for full confidence
