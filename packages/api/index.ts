import { Elysia, t } from "elysia";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import { files } from './schema';
import { migrate } from 'drizzle-orm/postgres-js/migrator';


const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

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

.get('/upload/url', async ({ query }) => {
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
    type: t.String()
  })
})

.post('/upload', async ({ body }) => {
  const result = await db.insert(files).values({
    filename: body.filename,
    key: body.key,
    userId: body.userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

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

// Delete a file from S3 and DB
.delete('/file', async ({ query }) => {
  const command = new DeleteObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: query.key
  });

  await s3.send(command);
  
  await db
    .delete(files)
    .where(eq(files.key, query.key));

  return { deleted: true };
}, {
  query: t.Object({
    key: t.String()
  })
})

.listen(process.env.PORT || 3001);


