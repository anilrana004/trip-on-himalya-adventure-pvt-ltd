# Recovery test log

Record every restore drill here (and optionally mirror a one-liner in `../DISASTER_RECOVERY.md`).

| Date | Environment | Backup artifact | Destination | Result | RTO notes | Operator |
|---|---|---|---|---|---|---|
| 2026-09-27 | Local MinIO | see DISASTER_RECOVERY.md drill | `securetravels_restore_drill` | OK | &lt; 2 s local | prior |
| _pending_ | Railway cron + dedicated bucket | _not yet provisioned_ | isolated | — | — | — |

## Checklist for a passing drill

- [ ] `backup-postgres.sh --self-test` passed
- [ ] Dump uploaded / retrieved
- [ ] `verify.sh` passed
- [ ] `restore.sh` into non-prod DB succeeded
- [ ] Row-count spot checks matched
- [ ] API health UP against restore DB
- [ ] Scratch resources destroyed
- [ ] No production credentials printed in logs
