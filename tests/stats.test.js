const { expect } = require('chai');
const request = require('supertest');
const server = require('../server');

describe('GET /stats Endpoint', () => {
  it('return number of files and users', (done) => {
    request(server)
      .get('/stats')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err);
        expect(res.body).to.have.property('files');
        expect(res.body).to.have.property('users');
        expect(res.body.files).to.be.a('number');
        expect(res.body.users).to.be.a('number');
        done();
      });
  });
});
