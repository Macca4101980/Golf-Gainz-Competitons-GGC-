# GGC release requirements

- Before changing code, inspect the actual deployment serving golfgainzcomps.co.uk and record its commit. Never assume main is the deployed source.
- A release must contain the current production commit. Run scripts/check-release-baseline.mjs with PRODUCTION_COMMIT set to the freshly verified deployment SHA.
- Preserve production authentication, password settings, field-level saving, transactional Group membership, admin cards, course snapshots and Winter League behaviour. Review the complete diff against production.
- Run the complete test suite and build. Stage and verify the exact production candidate before promotion. Automated tests do not replace authenticated save/reopen and two-session checks.
- Do not deploy an older build or rollback without explaining the changes removed and obtaining explicit user approval.
- Keep main and the actual release source reconciled. A successful build or a version label is not proof of release readiness.
