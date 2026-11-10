const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const prisma = require("../../src/config/db");
const app = require("../../app");
process.env.JWT_SECRET = "archive-authorization-test-only";
test("Complaint soft deletion respects current identity and preserves audit", async (t) => {
  const original = {
    user: prisma.user.findUnique,
    find: prisma.complaint.findUnique,
    update: prisma.complaint.updateMany,
  };
  t.after(() => {
    prisma.user.findUnique = original.user;
    prisma.complaint.findUnique = original.find;
    prisma.complaint.updateMany = original.update;
  });
  const accounts = {
    owner: { id: "owner", role: "RESIDENT" },
    other: { id: "other", role: "RESIDENT" },
    admin: { id: "admin", role: "ADMIN" },
  };
  const records = {
    owned: {
      id: "owned",
      residentId: "owner",
      archivedAt: null,
      history: ["preserved"],
    },
    managed: { id: "managed", residentId: "owner", archivedAt: null },
  };
  let writes = 0;
  prisma.user.findUnique = async ({ where }) => accounts[where.id] || null;
  prisma.complaint.findUnique = async ({ where }) => records[where.id] || null;
  prisma.complaint.updateMany = async ({ where, data }) => {
    const row = records[where.id];
    assert.equal(where.deletedAt, null);
    if (where.residentId) assert.equal(where.residentId, "owner");
    if (
      !row ||
      row.deletedAt ||
      (where.archivedAt === null ? Boolean(row.archivedAt) : !row.archivedAt) ||
      (where.residentId && where.residentId !== row.residentId)
    )
      return { count: 0 };
    writes++;
    Object.assign(row, data);
    return { count: 1 };
  };
  const tokens = Object.fromEntries(
    Object.values(accounts).map((u) => [
      u.id,
      jwt.sign({ id: u.id, role: u.role }, process.env.JWT_SECRET),
    ]),
  );
  const archive = (id, who, body = { reason: "No longer needed" }) =>
    request(app)
      .post("/api/complaints/" + id + "/archive")
      .auth(tokens[who], { type: "bearer" })
      .send(body);
  await t.test("other residents cannot archive a complaint", async () => {
    assert.equal((await archive("owned", "other")).status, 403);
    assert.equal(writes, 0);
  });
  await t.test("owner must provide a valid audit reason", async () => {
    assert.equal((await archive("owned", "owner", { reason: "" })).status, 400);
    assert.equal(
      (await archive("owned", "owner", { reason: "x".repeat(501) })).status,
      400,
    );
    assert.equal(writes, 0);
  });
  await t.test(
    "owner soft-deletes with immutable audit and preserved history",
    async () => {
      assert.equal((await archive("owned", "owner")).status, 200);
      assert.ok(records.owned.archivedAt instanceof Date);
      assert.equal(records.owned.archivedById, "owner");
      assert.equal(records.owned.archiveReason, "No longer needed");
      assert.equal(records.owned.isOverdue, false);
      assert.deepEqual(records.owned.history, ["preserved"]);
      assert.equal(
        (await archive("owned", "owner", { reason: "Overwrite" })).status,
        409,
      );
      assert.equal(records.owned.archiveReason, "No longer needed");
    },
  );
  await t.test(
    "demoted admin token cannot archive another resident record",
    async () => {
      accounts.admin.role = "RESIDENT";
      assert.equal((await archive("managed", "admin")).status, 403);
      accounts.admin.role = "ADMIN";
      assert.equal((await archive("managed", "admin")).status, 200);
      assert.equal(records.managed.archivedById, "admin");
    },
  );
  await t.test("archived deletion enforces ownership, active-state guard and retained history", async () => {
    const remove = (id, who) => request(app).delete("/api/complaints/" + id).auth(tokens[who], {type:"bearer"});
    records.active = {residentId:"owner",archivedAt:null};
    assert.equal((await remove("active","owner")).status,409);
    assert.equal((await remove("owned","other")).status,403);
    accounts.admin.role = "RESIDENT";
    assert.equal((await remove("managed","admin")).status,403);
    accounts.admin.role = "ADMIN";
    assert.equal((await remove("owned","owner")).status,200);
    assert.equal(records.owned.deletedById,"owner");
    assert.ok(records.owned.deletedAt instanceof Date);
    assert.deepEqual(records.owned.history,["preserved"]);
    assert.equal((await remove("owned","owner")).status,404);
    assert.equal((await archive("owned","owner")).status,404);
    assert.equal((await remove("managed","admin")).status,200);
    assert.equal(records.managed.deletedById,"admin");
  });
  await t.test(
    "missing records, disabled and deleted accounts cannot mutate",
    async () => {
      assert.equal((await archive("missing", "owner")).status, 404);
      accounts.owner.disabled = true;
      assert.equal((await archive("owned", "owner")).status, 401);
      delete accounts.owner;
      assert.equal((await archive("owned", "owner")).status, 401);
    },
  );
});
