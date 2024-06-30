const { expect } = require('chai');
const request = require('supertest');
const server = require('../server');

describe('GET /status Endpoint', () => {
  it('return status of Redis and DB', (done) => {
    request(server)
      .get('/status')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body.redis).to.be.true;
        expect(res.body.db).to.be.true;
        done();
      });
  });
});
