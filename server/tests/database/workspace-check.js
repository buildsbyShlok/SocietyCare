// Opt-in PostgreSQL integration check. All test writes share one rolled-back transaction.
require("dotenv").config();
const assert = require("node:assert/strict");
const { randomUUID, randomBytes } = require("node:crypto");
const request = require("supertest");
const bcrypt = require("bcrypt");
const prisma = require("../../src/config/db");
const dbModule = require.cache[require.resolve("../../src/config/db")];
const rollback = new Error("rollback successful QA run");
async function run() {
  if (
    !["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(process.env.DATABASE_URL).hostname,
    )
  )
    throw Error("This check requires local PostgreSQL.");
  for (const key of [
    "RESEND_API_KEY",
    "FROM_EMAIL",
    "GROQ_API_KEY",
    "CLOUDINARY_API_KEY",
  ])
    delete process.env[key];
  const salt = randomUUID();
  const password = randomBytes(16).toString("hex");
  const hash = await bcrypt.hash(password, 4);
  try {
    await prisma.$transaction(
      async (tx) => {
        // Bind the ordinary Express routes to this transaction without substituting model methods.
        dbModule.exports = new Proxy(tx, {
          get(target, key) {
            if (key !== "$transaction") return Reflect.get(target, key);
            // Service transactions remain in the outer rollback, with a real PostgreSQL savepoint.
            return async (work) => {
              await tx.$executeRawUnsafe("SAVEPOINT service_transaction");
              try {
                const result = await work(tx);
                await tx.$executeRawUnsafe(
                  "RELEASE SAVEPOINT service_transaction",
                );
                return result;
              } catch (error) {
                await tx.$executeRawUnsafe(
                  "ROLLBACK TO SAVEPOINT service_transaction",
                );
                await tx.$executeRawUnsafe(
                  "RELEASE SAVEPOINT service_transaction",
                );
                throw error;
              }
            };
          },
        });
        const app = require("../../app");
        const account = async (role) =>
          tx.user.create({
            data: {
              name: "Integration QA",
              email: randomUUID() + "@example.test",
              password: hash,
              flatNumber: salt,
              role,
            },
          });
        const admin = await account("ADMIN"),
          owner = await account("RESIDENT"),
          other = await account("RESIDENT");
        const login = async (account) =>
          (
            await request(app)
              .post("/api/auth/login")
              .send({ email: account.email, password })
              .expect(200)
          ).body.token;
        const a = await login(admin),
          r = await login(owner),
          outsider = await login(other);
        const api = (method, path, token) =>
          request(app)
            [method]("/api" + path)
            .auth(token, { type: "bearer" });
        await request(app).get("/api/community").expect(401);
        await api("patch", "/society", r)
          .send({ name: "Forbidden" })
          .expect(403);
        await api("patch", "/society", a)
          .send({
            name: "QA society",
            address: "Test address",
            totalFlats: 20,
            maintenanceDate: "2026-12-01",
            upcomingMaintenance: "Elevator inspection",
          })
          .expect(200);
        assert.equal(
          (await api("get", "/society", r)).body.society.name,
          "QA society",
        );
        console.log("PASS society configuration and authorization");
        await request(app).get("/api/events").expect(401);
        const eventPayload = {
          title: "Society gathering",
          description: "Neighbours meet in the courtyard.",
          location: "Courtyard",
          startsAt: "2027-01-10T12:00:00.000Z",
        };
        const event = (
          await api("post", "/events", r).send(eventPayload).expect(201)
        ).body;
        assert.equal(
          (await api("get", "/events/" + event.id, outsider).expect(200)).body
            .creatorId,
          owner.id,
        );
        await api("patch", "/events/" + event.id, outsider)
          .send(eventPayload)
          .expect(403);
        await api("delete", "/events/" + event.id, outsider).expect(403);
        await api("patch", "/events/" + event.id, r)
          .send({ ...eventPayload, title: "Updated gathering" })
          .expect(200);
        await api("patch", "/events/" + event.id, a)
          .send({ ...eventPayload, location: "Hall" })
          .expect(200);
        await api("post", "/events", r)
          .send({ ...eventPayload, startsAt: "2027-02-30T12:00:00.000Z" })
          .expect(400);
        await api("post", "/events", r)
          .field(eventPayload)
          .attach("image", Buffer.from("not an image"), {
            filename: "fake.png",
            contentType: "image/png",
          })
          .expect(400);
        await api("post", "/events", r)
          .field(eventPayload)
          .attach("image", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), {
            filename: "image.png",
            contentType: "image/png",
          })
          .expect(503);
        assert.ok(
          (await api("get", "/events?upcoming=true", r)).body.items.some(
            (e) => e.id === event.id,
          ),
        );
        await api("delete", "/events/" + event.id, r).expect(200);
        await api("get", "/events/" + event.id, r).expect(404);
        assert.ok(await tx.event.findUnique({ where: { id: event.id } }));
        const notice = (
          await api("post", "/notices", a)
            .send({
              title: "Notice board QA",
              content: "Residents are invited to read this notice.",
              category: "Community",
            })
            .expect(201)
        ).body.notice;
        assert.equal(
          (await api("get", "/notices/" + notice.id, r).expect(200)).body
            .category,
          "Community",
        );
        await api("patch", "/notices/" + notice.id, r)
          .send({
            title: "Forbidden",
            content: "Cannot change this announcement.",
          })
          .expect(403);
        await api("post", "/notices", a)
          .send({
            title: "Bad category",
            content: "This is invalid input.",
            category: "invalid",
          })
          .expect(400);
        await api("get", "/notices/missing-notice", r).expect(404);
        console.log(
          "PASS events: persistence, owner/admin management, public viewing, invalid dates/images, unavailable uploads, soft removal; notice details/categories/RBAC",
        );
        const bill = {
          residentId: owner.id,
          amount: "99.75",
          month: "2026-06",
          dueDate: "2026-06-15",
        };
        await api("post", "/billing", r).send(bill).expect(403);
        const issued = (await api("post", "/billing", a).send(bill).expect(201))
          .body;
        assert.equal(issued.status, "OVERDUE");
        assert.equal(
          (await api("get", "/billing", r)).body.items[0].id,
          issued.id,
        );
        assert.equal(
          (await api("get", "/billing", outsider)).body.items.length,
          0,
        );
        assert.equal(
          Number((await api("get", "/dashboard", r)).body.outstanding),
          99.75,
        );
        // PostgreSQL marks unique-constraint failures inside an outer transaction as aborted.
        // Bound each expected conflict with a savepoint so the rest of this QA run can proceed.
        await tx.$executeRawUnsafe("SAVEPOINT duplicate_bill");
        await api("post", "/billing", a).send(bill).expect(409);
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_bill");
        await api("post", "/billing/" + issued.id + "/payment", r)
          .send({ reference: salt })
          .expect(403);
        const receipt = (
          await api("post", "/billing/" + issued.id + "/payment", a)
            .send({ reference: salt })
            .expect(201)
        ).body;
        const paid = (await api("get", "/billing", r)).body.items[0];
        assert.equal(paid.status, "PAID");
        assert.equal(paid.payment.id, receipt.id);
        assert.equal(
          Number((await api("get", "/dashboard", r)).body.outstanding),
          0,
        );
        const profile = (
          await api("get", "/users/" + owner.id + "/record", a).expect(200)
        ).body;
        assert.equal(profile.bills[0].payment.id, receipt.id);
        assert.equal(profile.password, undefined);
        await api("get", "/users/" + owner.id + "/record", outsider).expect(
          403,
        );
        await tx.$executeRawUnsafe("SAVEPOINT duplicate_payment");
        await api("post", "/billing/" + issued.id + "/payment", a)
          .send({ reference: salt })
          .expect(409);
        await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT duplicate_payment");
        console.log(
          "PASS invoices, overdue and paid states, duplicate protection, receipts, dashboard balances, private profile history",
        );
        const message = (
          await api("post", "/community", r)
            .send({ body: "Integration test message" })
            .expect(201)
        ).body;
        assert.deepEqual(Object.keys(message.sender).sort(), [
          "avatarUrl",
          "flatNumber",
          "name",
          "role",
          "tower",
        ]);
        assert.ok(
          (await api("get", "/community", outsider)).body.items.some(
            (m) => m.id === message.id,
          ),
        );
        await api("post", "/community/" + message.id + "/report", outsider)
          .send({ reason: "Test moderation" })
          .expect(201);
        await api("get", "/community/reports", r).expect(403);
        assert.ok(
          (await api("get", "/community/reports", a)).body.items.some(
            (m) => m.id === message.id,
          ),
        );
        const reply = (
          await api("post", "/community", a)
            .send({ body: "Admin reply", replyToId: message.id })
            .expect(201)
        ).body;
        assert.equal(reply.replyTo.id, message.id);
        assert.equal(reply.sender.role, "ADMIN");
        await api("post", "/community", outsider)
          .send({ body: "Reply to absent message", replyToId: "missing" })
          .expect(404);
        await api("post", "/community", outsider)
          .send({ body: "" })
          .expect(400);
        await api("post", "/community", outsider)
          .send({ body: "x".repeat(1001) })
          .expect(400);
        await api("post", "/community", outsider)
          .field("body", "Image test")
          .attach("image", Buffer.from("invalid"), {
            filename: "fake.png",
            contentType: "image/png",
          })
          .expect(400);
        await api("post", "/community", outsider)
          .attach("image", Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]), {
            filename: "image.png",
            contentType: "image/png",
          })
          .expect(503);
        await api("delete", "/community/" + message.id, r).expect(403);
        await api("delete", "/community/" + message.id, a).expect(200);
        assert.ok(
          !(await api("get", "/community", r)).body.items.some(
            (m) => m.id === message.id,
          ),
        );
        const redacted = (
          await api("get", "/community", outsider)
        ).body.items.find((m) => m.id === reply.id);
        assert.deepEqual(redacted.replyTo, {
          id: message.id,
          unavailable: true,
        });
        console.log(
          "PASS chat replies, removed-parent redaction, admin identity, invalid messages and attachments",
        );
        for (let i = 0; i < 7; i++)
          await api("post", "/community", r)
            .send({ body: "Rate limit test " + i })
            .expect(201);
        await api("post", "/community", r)
          .send({ body: "Too many" })
          .expect(429);
        console.log(
          "PASS community persistence, sender privacy, reports, moderation and rate limit",
        );
        const ticket = (
          await api("post", "/complaints", r)
            .send({
              title: "Archive check",
              description: "Integration QA ticket only.",
              category: "OTHER",
              priority: "LOW",
            })
            .expect(201)
        ).body.complaint;
        await api("post", "/complaints/" + ticket.id + "/archive", outsider)
          .send({ reason: "Forbidden" })
          .expect(403);
        await api("post", "/complaints/" + ticket.id + "/archive", a)
          .send({ reason: "Integration audit" })
          .expect(200);
        const history = (
          await api("get", "/complaints/" + ticket.id, r).expect(200)
        ).body.complaint;
        assert.equal(history.archivedById, admin.id);
        assert.equal(history.archiveReason, "Integration audit");
        assert.ok(history.archivedAt);
        assert.equal((await api("get", "/complaints", r)).body.totalItems, 0);
        assert.equal(
          (await api("get", "/dashboard", r)).body.totalComplaints,
          0,
        );
        assert.ok(
          (await api("get", "/complaints?archived=true", a)).body.items.some(
            (c) => c.id === ticket.id,
          ),
        );
        await api("patch", "/complaints/" + ticket.id + "/status", a)
          .send({ status: "RESOLVED" })
          .expect(409);

        const ownTicket = (
          await api("post", "/complaints", r)
            .send({
              title: "Resident removal",
              description: "Owner soft deletion QA",
              category: "OTHER",
              priority: "LOW",
            })
            .expect(201)
        ).body.complaint;
        await api("delete", "/complaints/" + ownTicket.id, r).expect(409);
        await api("patch", "/complaints/" + ownTicket.id + "/status", r)
          .send({ status: "IN_PROGRESS", remark: "Not authorized" })
          .expect(403);
        const managed = (
          await api("patch", "/complaints/" + ownTicket.id + "/status", a)
            .send({
              status: "IN_PROGRESS",
              remark: "Assigned to maintenance",
            })
            .expect(200)
        ).body.complaint;
        assert.equal(managed.status, "IN_PROGRESS");
        const audit = managed.history.find(
          (h) => h.remark === "Assigned to maintenance",
        );
        assert.ok(audit);
        const stats = (await api("get", "/dashboard", r).expect(200)).body;
        assert.equal(
          stats.totalComplaints,
          await tx.complaint.count({
            where: { residentId: owner.id, archivedAt: null },
          }),
        );
        for (const state of ["OPEN", "IN_PROGRESS", "RESOLVED"])
          assert.equal(
            stats.byStatus[state],
            await tx.complaint.count({
              where: { residentId: owner.id, archivedAt: null, status: state },
            }),
          );
        console.log(
          "PASS admin status/remark management and dashboard counts against PostgreSQL",
        );
        await api("post", "/complaints/" + ownTicket.id + "/archive", r)
          .send({ reason: "" })
          .expect(400);
        await api("post", "/complaints/" + ownTicket.id + "/archive", outsider)
          .send({ reason: "Not allowed" })
          .expect(403);
        await tx.user.update({
          where: { id: admin.id },
          data: { role: "RESIDENT" },
        });
        await api("post", "/complaints/" + ownTicket.id + "/archive", a)
          .send({ reason: "Stale admin token" })
          .expect(403);
        await tx.user.update({
          where: { id: admin.id },
          data: { role: "ADMIN" },
        });
        await api("post", "/complaints/" + ownTicket.id + "/archive", r)
          .send({ reason: "Resident confirmed deletion" })
          .expect(200);
        const removed = (
          await api("get", "/complaints/" + ownTicket.id, r).expect(200)
        ).body.complaint;
        assert.equal(removed.archivedById, owner.id);
        assert.equal(removed.archiveReason, "Resident confirmed deletion");
        assert.ok(removed.history.some((h) => h.id === audit.id));
        assert.ok(
          await tx.complaint.findUnique({ where: { id: ownTicket.id } }),
        );
        await api("post", "/complaints/" + ownTicket.id + "/archive", r)
          .send({ reason: "Overwrite audit" })
          .expect(409);
        await api("get", "/complaints/" + ownTicket.id, outsider).expect(403);
        assert.equal(
          (await api("get", "/dashboard", r)).body.totalComplaints,
          0,
        );
        assert.equal((await api("get", "/complaints", r)).body.totalItems, 0);
        console.log(
          "PASS resident soft deletion, ownership, stale admin rejection, preserved audit/history and dashboard exclusion",
        );
        // Archive visibility and soft deletion are exercised against actual PostgreSQL records.
        const archiveList = (await api("get", "/complaints?archived=true", r).expect(200)).body;
        assert.ok(archiveList.items.some(c => c.id === ownTicket.id));
        assert.equal((await api("get", "/complaints?archived=true", outsider)).body.totalItems,0);
        await api("delete", "/complaints/" + ownTicket.id, outsider).expect(403);
        await api("delete", "/complaints/" + ownTicket.id, r).expect(200);
        const retained = await tx.complaint.findUnique({where:{id:ownTicket.id},include:{history:true}});
        assert.equal(retained.deletedById,owner.id);
        assert.ok(retained.deletedAt);
        assert.ok(retained.history.some(h=>h.id===audit.id));
        await api("get", "/complaints/" + ownTicket.id, r).expect(404);
        await api("get", "/complaints/" + ownTicket.id, a).expect(404);
        await api("delete", "/complaints/" + ownTicket.id, r).expect(404);
        assert.ok(!(await api("get", "/complaints?archived=true", r)).body.items.some(c=>c.id===ownTicket.id));
        assert.ok(!(await api("get", "/users/" + owner.id + "/record", a)).body.complaints.some(c=>c.id===ownTicket.id));
        await api("delete", "/complaints/" + ticket.id, a).expect(200);
        assert.equal((await tx.complaint.findUnique({where:{id:ticket.id}})).deletedById,admin.id);
        console.log("PASS owner/admin archived deletion, ownership, retained audit and exclusion from details/lists/profiles");

        await api("patch", "/users/" + other.id + "/role", r).send({role:"ADMIN"}).expect(403);
        await api("delete", "/users/" + other.id, r).expect(403);
        await api("patch", "/users/" + admin.id + "/role", a).send({role:"RESIDENT"}).expect(400);
        await api("delete", "/users/" + admin.id, a).expect(400);
        await api("patch", "/users/profile", r).send({name:"QA owner",role:"ADMIN",disabled:false}).expect(200);
        assert.equal((await tx.user.findUnique({where:{id:owner.id}})).role,"RESIDENT");
        await api("patch", "/users/" + other.id + "/role", a).send({role:"ADMIN"}).expect(200);
        await api("get", "/users", outsider).expect(200); // Old resident token gains only the current DB role.
        const promotedToken = await login(other);
        await api("patch", "/users/" + other.id + "/role", a).send({role:"RESIDENT"}).expect(200);
        await api("get", "/users", promotedToken).expect(403);
        await api("delete", "/users/" + owner.id, promotedToken).expect(403);
        const survivingEvent=(await api("post","/events",r).send(eventPayload).expect(201)).body;
        const survivingTicket=(await api("post","/complaints",r).send({title:"Retained work",description:"Work remains after account deletion.",category:"OTHER",priority:"LOW"}).expect(201)).body.complaint;
        const survivingMessage=await tx.communityMessage.create({data:{senderId:owner.id,body:"Retained community discussion"}});
        await api("delete", "/users/" + owner.id, a).expect(200);
        assert.equal(await tx.user.findUnique({where:{id:owner.id}}),null);
        assert.ok(await tx.bill.findUnique({where:{id:issued.id}}));
        assert.ok(await tx.payment.findUnique({where:{id:receipt.id}}));
        assert.ok(await tx.event.findUnique({where:{id:event.id}}));
        assert.ok(await tx.communityMessage.findUnique({where:{id:message.id}}));
        assert.ok(await tx.complaint.findUnique({where:{id:ownTicket.id}}));
        await api("delete", "/users/" + owner.id, a).expect(404);
        console.log("PASS role promotion/demotion, payload tampering denial, self-protection, resident deletion denial and permanent account deletion with relations retained");

        await api("get", "/billing", r).expect(401);
        await request(app)
          .post("/api/auth/login")
          .send({ email: owner.email, password })
          .expect(401);
        console.log(
          "PASS archive audit, active queue exclusion, read-only archived tickets, deleted-account enforcement",
        );
        await api("get","/auth/me",r).expect(401);
        await api("get","/users/"+owner.id+"/record",a).expect(404);
        assert.equal((await tx.bill.findUnique({where:{id:issued.id}})).residentId,null);
        const billAfter=(await api("get","/billing",a)).body.items.find(b=>b.id===issued.id);
        assert.equal(billAfter.resident,null);assert.equal(billAfter.payment.id,receipt.id);
        const eventAfter=(await api("get","/events/"+survivingEvent.id,outsider).expect(200)).body;
        assert.equal(eventAfter.creator,null);
        const chatAfter=(await api("get","/community",outsider)).body.items.find(m=>m.id===survivingMessage.id);
        assert.equal(chatAfter.sender,null);assert.equal(chatAfter.body,survivingMessage.body);
        await api("get","/complaints/"+survivingTicket.id,outsider).expect(403);
        assert.equal((await api("get","/complaints/"+survivingTicket.id,a).expect(200)).body.complaint.resident,null);
        await api("patch","/complaints/"+survivingTicket.id+"/status",a).send({status:"IN_PROGRESS",remark:"Owner account deleted; work continues."}).expect(200);
        // Exercise reporter, author, audit actor and payment-verifier foreign keys too.
        await api("delete","/users/"+other.id,a).expect(200);
        assert.equal((await tx.messageReport.findFirst({where:{messageId:message.id}})).reporterId,null);
        const replacementAdmin=await account("ADMIN"), replacementToken=await login(replacementAdmin);
        await api("delete","/users/"+admin.id,replacementToken).expect(200);
        await api("get","/auth/me",a).expect(401);
        assert.equal((await tx.payment.findUnique({where:{id:receipt.id}})).verifiedById,null);
        assert.equal((await tx.complaintHistory.findUnique({where:{id:audit.id}})).changedById,null);
        assert.equal((await tx.notice.findUnique({where:{id:notice.id}})).authorId,null);
        assert.equal((await api("get","/notices/"+notice.id,replacementToken).expect(200)).body.author,null);
        console.log("PASS all eight nullable user relationships, retained active content/financial records, post-deletion management and revoked sessions");
        throw rollback;
      },
      { timeout: 30000 },
    );
  } catch (error) {
    if (error !== rollback && error.message !== rollback.message) throw error;
  } finally {
    dbModule.exports = prisma;
    await prisma.$disconnect();
  }
  console.log("PASS transaction rolled back");
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
