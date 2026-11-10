const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { validateRegister } = require('../../src/validations/auth.validation');
const pagination = require('../../src/utils/pagination');
const prisma = require('../../src/config/db');
const ai = require('../../src/services/ai.service');
const auth = require('../../src/services/auth.service');
const app = require('../../app');
const valid = { name: 'QA Resident', email: 'qa@example.test', password: 'test-password-123', flatNumber: 'QA-1' };
test('registration rejects truncatable UTF-8 passwords and oversized identity fields', () => {
  assert.deepEqual(validateRegister(valid), []);
  for (const change of [{password:'x'.repeat(73)}, {password:'😀'.repeat(19)}, {name:'x'.repeat(101)}, {flatNumber:'x'.repeat(41)}, {email:'x'.repeat(250)+'@a.test'}])
    assert.ok(validateRegister({...valid,...change}).length);
});
test('pagination handles invalid, repeated, negative and huge values without negative Prisma offsets', () => {
  for (const value of [-3, '-3', 'NaN', '1e100', ['2','3'], {}, '2.5', 0]) {
    const parsed = pagination({ page: value, limit: value });
    assert.equal(parsed.page, 1); assert.equal(parsed.limit, 10);
  }
  assert.deepEqual(pagination({page:'10001',limit:'1000000'}), {page:10000,limit:100,skip:999900,take:100});
  assert.deepEqual(pagination({page:'2',limit:'15'}), {page:2,limit:15,skip:15,take:15});
});
test('malformed and oversized JSON return controlled client errors', async () => {
  const malformed = await request(app).post('/api/auth/login').set('Content-Type','application/json').send('{"bad":');
  assert.equal(malformed.status,400);
  const large = await request(app).post('/api/auth/login').send({password:'x'.repeat(52000)});
  assert.equal(large.status,413);
});
test('concurrent registration uniqueness violation becomes 409', async t => {
  const find = prisma.user.findUnique, create = prisma.user.create;
  t.after(() => {prisma.user.findUnique=find;prisma.user.create=create;});
  prisma.user.findUnique = async () => null;
  prisma.user.create = async () => {throw Object.assign(new Error('private database details'),{code:'P2002'});};
  await assert.rejects(auth.registerUser(valid), e => e.statusCode===409 && !e.message.includes('private'));
});
test('duplicate detection respects resident ownership while admins retain society scope', async t => {
  const key=process.env.GROQ_API_KEY, find=prisma.complaint.findMany;
  process.env.GROQ_API_KEY='test-only';
  t.after(()=>{if(key===undefined)delete process.env.GROQ_API_KEY;else process.env.GROQ_API_KEY=key;prisma.complaint.findMany=find;});
  const queries=[];
  prisma.complaint.findMany=async query=>{queries.push(query.where);return[];};
  await ai.detectDuplicates('A test complaint about a leaking tap.',{id:'resident-1',role:'RESIDENT'});
  await ai.detectDuplicates('A test complaint about a leaking tap.',{id:'admin-1',role:'ADMIN'});
  assert.equal(queries[0].residentId,'resident-1');
  assert.equal(queries[1].residentId,undefined);
});
