const request = require('supertest');
const { createTestApp } = require('../_setup');

let app;

beforeAll(async () => {
  const setup = await createTestApp();
  app = setup.app;
});

describe('Integration test', () => {
  it('Health check', async () => {
    const res = await request(app)
      .get('/health')
      .set('Content-Type', 'application/json')
      .expect('Content-Type', /json/)
      .expect(200);

      expect(res.body.status).toEqual('healthy');
      expect(res.body.service).toEqual('school-management');
      expect(res.statusCode).to.equal(200);
  });
});