# Timesheet: Grow Coach bug fixes

**Name:** Emmanuel Azu
**Project:** Grow Coach (grow-za) and Pickaxe "Coach Max"
**Date:** 3 October 2026
**Hours:** 13:00 to 18:00 (5 hours, approximate)

| Time | Hours | Work done |
| --- | --- | --- |
| 13:00 to 14:00 | 1.0 | **Onboarding and review.** Forked the repo. Reviewed how the app works end to end (selection wizard, onboarding, API routes, email and calendar invites, daily cron). Read the Pickaxe API documentation and the Coach Max system prompt. Wrote up the project overview, the Pickaxe API review and the system prompt breakdown. |
| 14:00 to 15:00 | 1.0 | **Bug triage.** Reproduced the four reported bugs. Collected test chat transcripts and the Pickaxe memory exports. Mapped the cause of each bug, agreed the fix order (3, 1, 4, 2) and the rule that every change is approved first and documented. |
| 15:00 to 16:00 | 1.0 | **Bug 3 (buddy email expectations).** Revised the buddy email wording in the system prompt. Tested in the editor preview and the live portal. Investigated the wrong-name behaviour and traced it to Pickaxe's automatic memory collection. Recorded the unconfirmed name issue and the suggestions (TBC) in the bug doc. |
| 16:00 to 17:00 | 1.0 | **Bugs 1 and 4 (invite recipient, coachee copied).** Updated the two Pickaxe actions and their trigger prompts through Wingman. Verified the changes by re-exporting the manifests. Ran live tests A and B (coachee copied; send refused when coachee and buddy addresses match). Added the matching recipient safeguard, validation and 9 unit tests to the app (all pass). |
| 17:00 to 18:00 | 1.0 | **Bug 2 (invite bounce) and handover.** Diagnosed the bounce (no mailbox at coach@grow-za.com, Mimecast rejects the reply). Chose the fix and asked Katleho to create the mailbox. Opened the pull request, wrote the checklist for Katleho and the status email. |

**Total: 5.0 hours**

## Outputs

- Pull request: https://github.com/EmmanuelAzu/grow-za/pull/1
- Bug documentation: `docs/bug-fixes/` (one doc per bug, README index, checklist for Katleho)
- Three PDFs: project overview, Pickaxe API review, Coach Max system prompt breakdown

## Open items

Merge and deploy; create the coach@grow-za.com mailbox; test on a fresh signed-in account; copy the system prompt from testing E to main; decide who sends monthly summaries.
