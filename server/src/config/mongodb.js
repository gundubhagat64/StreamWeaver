import { MongoClient } from 'mongodb';

import env from './env.js';

let client;
let database;
let connectingPromise;

export async function connectMongoDB() {
  if (database) {
    return database;
  }

  if (!env.mongodbUri) {
    throw new Error(
      'MONGODB_URI is required for Week 4 ingestion. Configure it in server/.env.',
    );
  }

  if (!connectingPromise) {
    connectingPromise = (async () => {
      const nextClient = new MongoClient(env.mongodbUri, {
        maxPoolSize: 10,
      });

      try {
        await nextClient.connect();

        const nextDatabase = nextClient.db(env.mongodbDatabase);
        await nextDatabase.command({ ping: 1 });

        client = nextClient;
        database = nextDatabase;

        console.log(
          `MongoDB connected: ${env.mongodbDatabase}`,
        );

        return database;
      } catch (error) {
        await nextClient.close().catch(() => {});
        throw error;
      } finally {
        connectingPromise = null;
      }
    })();
  }

  return connectingPromise;
}

export async function getIngestionCollection() {
  const db = await connectMongoDB();
  return db.collection(env.mongodbCollection);
}

export async function closeMongoDB() {
  if (!client) {
    return;
  }

  await client.close();

  client = null;
  database = null;
  connectingPromise = null;

  console.log('MongoDB connection closed.');
}
