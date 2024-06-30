const dbClient = require('./utils/db');
const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const fs = require('fs').promises;

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;

  if (!userId) {
    throw new Error('Missing userId');
  }

  if (!fileId) {
    throw new Error('Missing fileId');
  }

  const file = await dbClient.db.collection('files').findOne({
    _id: ObjectId(fileId),
    userId: ObjectId(userId)
  });

  if (!file) {
    throw new Error('File not found');
  }

  const filePath = file.localPath;

  const sizes = [500, 250, 100];
  const thumbnailPromises = sizes.map(async (size) => {
    const thumbnailPath = `${filePath}_${size}`;
    const thumbnail = await imageThumbnail(filePath, { width: size });
    await fs.writeFile(thumbnailPath, thumbnail);
  });

  await Promise.all(thumbnailPromises);
});

module.exports = fileQueue;
