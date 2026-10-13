# GGC Supabase Edge Functions

`send-ggc-invite/index.ts` uses `ggc_records` and the version-checked `ggc_save_record` RPC. Never restore `ggc_state` reads/writes to live invitation functions.

## Deploy

Install Supabase CLI, authenticate, then run from the repository root:

```sh
supabase functions deploy send-ggc-invite --project-ref omgnfrybqiqgxnpwgfol
```

After authenticated integration tests pass against the isolated project, deploy the identical committed source to production:

```sh
supabase functions deploy send-ggc-invite --project-ref yqwnbwkqjvqtdxvlscko
```

JWT verification must remain enabled. Configure `RESEND_API_KEY` and optional `GGC_INVITE_FROM` in the destination project. Do not deploy to production until a test invitation, permissions denial, version-conflict test and delivered-email check pass. Keep the old `ggc_state` snapshot for read-only recovery only.
