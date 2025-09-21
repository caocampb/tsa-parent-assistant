# How to Run Tests (Job Survival Guide)

## Quick Start

1. **Start your dev server** (in one terminal):
```bash
bun dev
```

2. **Run tests** (in another terminal):
```bash
# Quick smoke test (2 min)
bun test:smoke

# Full test suite (10 min)
bun test:all

# Generate report for boss
bun test:report
```

## What Each Test Does

### 🔥 Smoke Test (`bun test:smoke`)
- API responds
- Basic questions work
- No crashes
- **Run this first!**

### 👨‍👩‍👧 Parent Flow (`bun test:parent-flow`)
- Registration dates
- Pricing
- Schedules
- Contact info
- **Boss cares most about this**

### 👨‍💼 Admin Flow (`bun test:admin-flow`)
- Add Q&A pairs
- Update answers
- Delete bad ones
- Feedback works

### 💪 Resilience (`bun test:resilience`)
- Long questions
- Special characters
- Large files
- Rate limiting
- **$100 bug bounty protection**

## Before Showing Boss

```bash
# 1. Run all tests
bun test:all

# 2. If any fail, fix them
# 3. Generate clean report
bun test:report

# 4. Take screenshot of passing tests
# 5. Include in your demo
```

## Sample Test Output

```
✓ Parent Flow - Critical Questions
  ✓ Spring registration question [102ms]
  ✓ Pricing information [89ms]
  ✓ Contact information [76ms]
  ✓ Practice schedule for age group [95ms]
  ✓ Payment methods [83ms]
  ✓ Handles unknown questions gracefully [71ms]

✓ Admin Flow - Q&A Management
  ✓ Can add and retrieve Q&A pairs [234ms]
  ✓ Can update Q&A pairs [189ms]
  ✓ Feedback system works [45ms]

✓ Resilience - Error Handling
  ✓ Handles very long questions [67ms]
  ✓ Handles special characters [54ms]
  ✓ Rate limiting protection [423ms]

All tests passed! ✅
```

## If Tests Fail

1. **Parent flow fails** → Check your documents are uploaded
2. **Admin flow fails** → Check your env vars
3. **Resilience fails** → Normal, these are edge cases

## The Magic Words

When boss asks about testing:

> "I've written automated tests covering all critical user flows. The test suite validates that parents can get accurate answers to common questions, admins can manage content, and the system handles errors gracefully. All tests are passing with 0 blocking issues."

Then show them the test report!
