import { Elysia, t } from "elysia";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { files, users } from './schema';
import { migrate } from 'drizzle-orm/postgres-js/migrator';

const FILE_LIMIT = 2; 

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

export { db };

// Run migrations
const runMigrations = async () => {
  console.log('Running migrations...');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('Migrations completed');
};

runMigrations().catch(console.error);

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

const app = new Elysia()

// Check user file count and limit
.get('/user/:userId/file-stats', async ({ params }) => {
  const user = await db
    .select({ fileCount: users.fileCount })
    .from(users)
    .where(eq(users.id, params.userId));

  if (!user[0]) {
    throw new Error('User not found');
  }

  return { 
    fileCount: user[0].fileCount,
    fileLimit: FILE_LIMIT,
    canUpload: user[0].fileCount < FILE_LIMIT
  };
}, {
  params: t.Object({
    userId: t.String()
  })
})

.get('/upload/url', async ({ query }) => {
  // Check if user can upload more files
  const user = await db
    .select({ fileCount: users.fileCount })
    .from(users)
    .where(eq(users.id, query.userId));

  if (!user[0]) {
    throw new Error('User not found');
  }

  if (user[0].fileCount >= FILE_LIMIT) {
    throw new Error(`File limit reached. Maximum ${FILE_LIMIT} files allowed.`);
  }

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: query.filename,
    ContentType: query.type,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 60 });
  return { url };
}, {
  query: t.Object({
    filename: t.String(),
    type: t.String(),
    userId: t.String()
  })
})

.post('/upload', async ({ body }) => {
  // Double-check file limit before inserting
  const user = await db
    .select({ fileCount: users.fileCount })
    .from(users)
    .where(eq(users.id, body.userId));

  if (!user[0]) {
    throw new Error('User not found');
  }

  if (user[0].fileCount >= FILE_LIMIT) {
    throw new Error(`File limit reached. Maximum ${FILE_LIMIT} files allowed.`);
  }

  // Insert file record
  const result = await db.insert(files).values({
    filename: body.filename,
    key: body.key,
    userId: body.userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

  // Increment user file count
  await db
    .update(users)
    .set({ fileCount: user[0].fileCount + 1 })
    .where(eq(users.id, body.userId));

  return { success: true, file: result[0] };
}, {
  body: t.Object({
    filename: t.String(),
    key: t.String(),
    userId: t.String()
  })
})

// Get all files for a user
.get('/files/:userId', async ({ params }) => {
  const userFiles = await db
    .select()
    .from(files)
    .where(eq(files.userId, params.userId));
  
  return { files: userFiles };
}, {
  params: t.Object({
    userId: t.String()
  })
})

.get('/file/:id', async ({ params }) => {
  // Get file metadata from DB
  const file = await db
    .select()
    .from(files)
    .where(eq(files.id, params.id));

  if (!file[0]) {
    throw new Error('File not found');
  }

  // Generate a signed URL for downloading
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: file[0].key
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 3600 });

  return { 
    file: file[0],
    downloadUrl: url 
  };
}, {
  params: t.Object({
    id: t.String()
  })
})

// Delete a file from S3 and DB
.delete('/file', async ({ query }) => {
  // Get file info first to find the user
  const file = await db
    .select()
    .from(files)
    .where(eq(files.key, query.key));

  if (!file[0]) {
    throw new Error('File not found');
  }

  // Delete from S3
  const command = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: query.key
  });

  await s3.send(command);
  
  // Delete from database
  await db
    .delete(files)
    .where(eq(files.key, query.key));

  // Decrement user file count
  const user = await db
    .select({ fileCount: users.fileCount })
    .from(users)
    .where(eq(users.id, file[0].userId));

  if (user[0] && user[0].fileCount > 0) {
    await db
      .update(users)
      .set({ fileCount: user[0].fileCount - 1 })
      .where(eq(users.id, file[0].userId));
  }

  return { deleted: true };
}, {
  query: t.Object({
    key: t.String()
  })
})

.listen(process.env.PORT || 3001);


