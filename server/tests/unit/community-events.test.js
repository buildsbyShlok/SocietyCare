const test = require("node:test");
const assert = require("node:assert/strict");
const { eventData } = require("../../src/routes/event.routes");
const { validateImage } = require("../../src/services/image.service");
const { validateNotice } = require("../../src/validations/notice.validation");
const valid = {
  title: " Society picnic ",
  description: "Neighbours meet together.",
  location: "Courtyard",
  startsAt: "2027-01-10T12:00:00.000Z",
};
test("events normalize text and accept an explicit UTC timestamp", () => {
  const e = eventData(valid);
  assert.equal(e.title, "Society picnic");
  assert.equal(e.startsAt.toISOString(), valid.startsAt);
});
test("events reject normalized impossible dates and missing timezones", () => {
  for (const startsAt of [
    "2027-02-30T12:00:00Z",
    "2027-01-10T24:00:00Z",
    "2027-01-10T12:00",
    "invalid",
  ])
    assert.throws(
      () => eventData({ ...valid, startsAt }),
      (e) => e.statusCode === 400,
    );
});
test("events reject missing, oversized and non-string fields", () => {
  for (const change of [
    { title: "" },
    { description: {} },
    { location: "x".repeat(241) },
    { title: "x".repeat(151) },
  ])
    assert.throws(
      () => eventData({ ...valid, ...change }),
      (e) => e.statusCode === 400,
    );
});
test("image uploads reject spoofed MIME type and SVG content", () => {
  for (const mimetype of [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
  ])
    assert.throws(
      () => validateImage({ mimetype, buffer: Buffer.from("<svg/>") }),
      (e) => e.statusCode === 400,
    );
});
test("notice category is optional for existing clients and restricted when supplied", () => {
  const base = { title: "Test notice", content: "A complete announcement." };
  assert.deepEqual(validateNotice(base), []);
  assert.deepEqual(validateNotice({ ...base, category: "Security" }), []);
  assert.ok(validateNotice({ ...base, category: "Injected" }).length);
});
