# Checklist for Katleho

What is needed from you to finish the four bugs. Details for each item are in the linked bug
doc. Nothing here has been applied to the main Coach Max or to production.

## 1. Merge and deploy (repo and Vercel)

- [ ] Merge the PR from branch `fix/bug-4-copy-coachee`. It carries the bug 1, 3 and 4 work
      (docs, `lib/buddy-recipients.ts`, its tests, and the changes to `lib/send-manager-email.ts`
      and `app/api/send-manager-email/route.ts`). Later branch `fix/bug-2-invite-bounce` adds only docs.
- [ ] Run `npm test` (9 tests in `lib/buddy-recipients.test.mjs`) before or after merging.
- [ ] Deploy to Vercel.
- [ ] After deploy, check two things from bug 4 (see `BUG-004-copy-coachee-on-buddy-emails.md`):
  - sending with the coachee's address equal to the buddy's address returns a 400;
  - a reply from the buddy reaches the coachee (they are in Reply-To).

## 2. Mailbox for bug 2 (mail admin)

- [ ] Create a mailbox or alias `coach@grow-za.com` that delivers to whoever handles replies.
- [ ] Make sure the Mimecast recipient list accepts it (it currently answers "550 Invalid Recipient").
- [ ] Tell us who handles replies.
- [ ] If an alias is not possible, say so. The fallback is a configurable organiser address
      (option B in `BUG-002-invite-bounce-and-reschedule.md`), which needs a small code change.
- [ ] Test: accept an invite from a Google account. There should be no bounce, and the reply
      should arrive in the new inbox.
- [ ] Optional, later: send a "Propose new time" on a test invite and note what arrives. Nothing
      is built for this yet.

## 3. Test in Pickaxe (testing copy "Coach Max (testing E)")

The action manifests and trigger prompts were changed through Wingman and may already be live
on the main Coach Max too (they are shared by every agent that has the actions attached).
The system prompt edits are only in testing E.

- [ ] Check which agents have the `send_calendar_invite` and `send_manager_email` actions attached.
- [ ] Test 4, on a fresh signed-in account with no memories: run onboarding through to the buddy
      email, then start a fresh chat and ask "What's my name?" This settles two open questions:
  - whether the Name memory is stored correctly (bug 3; an earlier wrong name was seen on a shared
    test link, not yet reproduced on a clean account);
  - whether the platform sign-in email is passed to the actions (bug 1 signed-in path, untested).
- [ ] Book a session and send the buddy email as that account. Check that the invite goes to the
      coachee, and that the buddy email copies the coachee.
- [ ] Check the buddy email contains the "What to expect" paragraph (monthly summary, buddy's judgement,
      fortnightly goal).

## 4. Move to main Coach Max (only after the tests above pass)

- [ ] Run the marker-phrase check on main's system prompt to confirm it is still unchanged.
- [ ] Copy the system prompt edits in this order:
  1. bug 3: the "What to expect" block and the Name memory bullet (`BUG-003-buddy-expectations.md`);
  2. bug 1: the two edits (`BUG-001-calendar-invite-recipient.md`);
  3. bug 4: the one added sentence (`BUG-004-copy-coachee-on-buddy-emails.md`).
- [ ] Re-run one booking and one buddy email on main.

## 5. Decisions only you can make

- [ ] Who sends the monthly summary emails to buddies? The email promises them, but nothing sends
      them yet. Either someone does it by hand or we build it (S4 in the bug 3 doc).
- [ ] Whether to tighten the memory collection prompts (S1 to S3, S6 to S8 in the bug 3 doc), only if
      test 4 shows the name problem.
- [ ] Whether to clear the wrong values on your own test account's memories (we have not touched them).

## Reminder

API keys that were pasted into earlier chats should be revoked.
