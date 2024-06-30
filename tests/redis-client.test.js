const { expect } = require('chai');
const redisClient = require('../utils/redis');

describe('Redis Client Tests', () => {
  it('set and get a value from Redis', async () => {
    await redisClient.set('test_key', 'test_value');
    const result = await redisClient.get('test_key');
    expect(result).to.equal('test_value');
  });

  it('handle errors', async () => {
    try {
      await redisClient.get('not_a_key');
    } catch (error) {
      expect(error.message).to.equal('Key not found');
    }
  });
});
