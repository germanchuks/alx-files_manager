const { expect } = require('chai');
const dbClient = require('../utils/db');

describe('DB Client Tests', () => {
  it('connect to the database', async () => {
    const isConnected = await dbClient.connect();
    expect(isConnected).to.be.true;
  });

  it('handle errors', async () => {
    try {
      await dbClient.query('SELECT * FROM not_a_table');
    } catch (error) {
      expect(error.message).to.include('does not exist');
    }
  });
});
