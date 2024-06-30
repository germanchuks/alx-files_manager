import redisClient from '../utils/redis';
import dbClient from '../utils/db';
const { ObjectId } = require('mongodb');
const fs = require('fs');
import { v4 as uuidv4 } from 'uuid';
const path = require('path');
const mime = require('mime-types');
const Bull = require('bull');

const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(req, res) {

    const token = req.header['X-Token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { name, type, parentId = '0',
      isPublic = false, data } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    const validTypes = ['folder', 'file', 'image'];
    if (!type || !validTypes.includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    if (parentId !== '0') {
      const parentFile = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }
      if (parentFile.type !== 'folder') {
        return res.status(400)
          .json({ error: 'Parent is not a folder' });
      }
    }

    const file = {
      userId: ObjectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? 0 : ObjectId(parentId),
    }

    if (type === 'folder') {
      const result = await dbClient.db
        .collection('files')
        .insertOne(file);
      return res.status(201).json({
        id: result.insertedId,
        userId,
        name,
        type,
        isPublic,
        parentId,
      });
    }

    const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    const fileUuid = uuidv4();
    const localPath = path.join(folderPath, fileUuid);
    const fileData = Buffer.from(data, 'base64');

    fs.writeFileSync(localPath, fileData);

    file.localPath = localPath;

    const result = await dbClient.db
      .collection('files')
      .insertOne(file);

    fileQueue.add({ userId: userId, fileId: file._id });

    return res.status(201).json({
      id: result.insertedId,
      userId,
      name,
      type,
      isPublic,
      parentId,
    });
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    try {
      const file = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }
      return res.status(200).json(file);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: ObjectId(userId) });
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { parentId = '0', page = 0 } = req.query;
    const pageSize = 20;
    const skip = page * pageSize;

    const query = {
      userId: ObjectId(userId),
      parentId: parentId === '0' ? 0 : ObjectId(parentId),
    };

    const files = await dbClient.db.collection('files')
      .find(query)
      .skip(skip)
      .limit(pageSize)
      .toArray();

    return res.status(200).json(files);
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    try {
      const file = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      await dbClient.db.collection('files')
        .updateOne({ _id: ObjectId(id) },
          { $set: { isPublic: true } });

      const updatedFile = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(id) });
      return res.status(200).json(updatedFile);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];
    const userId = await redisClient.get(`auth_${token}`);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db
      .collection('users')
      .findOne({ _id: ObjectId(userId) });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;

    try {
      const file = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(id), userId: ObjectId(userId) });
      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      await dbClient.db
        .collection('files')
        .updateOne({ _id: ObjectId(id) },
          { $set: { isPublic: false } });

      const updatedFile = await dbClient.db
        .collection('files')
        .findOne({ _id: ObjectId(id) });
      return res.status(200).json(updatedFile);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];
    const { id } = req.params;
    const { size } = req.query;

    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const file = await dbClient.db.collection('files').findOne({
        _id: ObjectId(id),
        $or: [
          { isPublic: true },
          { userId: ObjectId(userId) }
        ]
      });

      if (!file) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (file.type === 'folder') {
        return res.status(400)
          .json({ error: 'A folder doesn\'t have content' });
      }

      const filePath = file.localPath;
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Not found' });
      }

      if (size && ['500', '250', '100'].includes(size)) {
        const thumbnailPath = `${filePath}_${size}`;
        if (!fs.existsSync(thumbnailPath)) {
          return res.status(404).json({ error: 'Not found' });
        }
        const mimeType = mime.lookup(file.name);
        res.setHeader('Content-Type', mimeType);
        return res.sendFile(thumbnailPath);
      }

      const mimeType = mime.lookup(file.name);
      res.setHeader('Content-Type', mimeType);
      return res.sendFile(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'Not found' });
    }
  }
}

module.exports = FilesController;
