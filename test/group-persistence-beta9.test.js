import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { planRecordChanges } from "../src/recordChanges.js";

const app = readFileSync(new URL("../src/main.jsx", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261022113000_transactional_group_membership_sync.sql",
    import.meta.url,
  ),
  "utf8",
);

test("group rename is a persisted society field while membership stays RPC-owned", () => {
  const before = {
    societies: [
      {
        id: "group-1",
        name: "Old name",
        members: ["owner", "member"],
        admins: ["owner"],
        ownerId: "owner",
      },
    ],
  };
  const after = {
    societies: [
      {
        ...before.societies[0],
        name: "New name",
        members: ["owner"],
      },
    ],
  };
  assert.deepEqual(planRecordChanges(before, after), [
    {
      kind: "societies",
      id: "group-1",
      data: { ...before.societies[0], name: "New name" },
      deleted: false,
    },
  ]);
});

test("field-store saves wait for the record coordinator", () => {
  assert.match(app, /const count=await appFieldPersist\(s\)/);
  assert.match(app, /throw Error\('GGC_RECORD_SYNC_NOT_READY'\)/);
});

test("all group membership controls use authoritative RPCs", () => {
  for (const rpc of [
    "ggc_group_remove_member",
    "ggc_group_leave",
    "ggc_group_set_admin",
    "ggc_group_transfer_owner",
    "ggc_group_claim_owner",
    "ggc_group_add_temporary_golfer",
    "ggc_group_join_code",
    "ggc_group_initialize",
    "ggc_group_invite_player",
    "ggc_group_respond_invitation",
  ]) {
    assert.match(app, new RegExp(`['"]${rpc}['"]`));
  }
});

test("database mutation synchronizes visible group membership transactionally", () => {
  assert.match(migration, /private\.ggc_sync_group_record/);
  assert.match(migration, /'\{members\}'/);
  assert.match(migration, /'\{admins\}'/);
  assert.match(migration, /'\{ownerId\}'/);
  assert.match(migration, /version = r\.version \+ 1/);
  assert.match(
    migration,
    /revoke execute on function public\.ggc_group_remove_member\(text,text\) from public, anon/,
  );
});
