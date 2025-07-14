import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and } from 'drizzle-orm';
import { files, users, parsedFiles, audioChunks } from './schema';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
// Import pdf-parse with debug mode workaround
const pdf = (() => {
  try {
    // Force module.parent to be true to avoid debug mode
    const module = { parent: {} };
    return require('pdf-parse');
  } catch (error) {
    console.error('Failed to load pdf-parse:', error);
    throw error;
  }
})();

const FILE_LIMIT = 2; 
const MAX_FILE_SIZE = 20 * 1024 * 1024;

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

// Configure S3 CORS
const configureCORS = async () => {
  const corsParams = {
    Bucket: process.env.S3_BUCKET_NAME,
    CORSConfiguration: {
      CORSRules: [
        {
          AllowedHeaders: ['*'],
          AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE'],
          AllowedOrigins: ['http://localhost:3000'],
          ExposeHeaders: ['ETag'],
          MaxAgeSeconds: 3600
        }
      ]
    }
  };
  
  try {
    await s3.send(new PutBucketCorsCommand(corsParams));
    console.log('S3 CORS configured success');
  } catch (error) {
    console.error('❌ Failed to configure S3 CORS automatically:', error);
  }
};

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  }
});

// Configure S3 CORS after S3 client is initialized
configureCORS().catch(console.error);

// Helper function to ensure user exists
const ensureUser = async (userId: string) => {
  const existingUser = await db
    .select({ fileCount: users.fileCount })
    .from(users)
    .where(eq(users.id, userId));

  if (!existingUser[0]) {
    await db.insert(users).values({
      id: userId,
      email: `user_${userId}@example.com`,
      fileCount: 0
    });
    return { fileCount: 0 };
  }

  return existingUser[0];
};

// File parsing service functions
const downloadFileFromS3 = async (key: string): Promise<Buffer> => {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key
  });
  
  const response = await s3.send(command);
  const stream = response.Body as any;
  
  // Convert stream to buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return Buffer.concat(chunks);
};

const parseFileContent = async (buffer: Buffer, filename: string): Promise<string> => {
  const extension = filename.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'pdf':
      try {
        const data = await pdf(buffer);
        return data.text.replace(/\s+/g, ' ').trim(); 
      } catch (error) {
        throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    
    case 'txt':
      try {
        let text = buffer.toString('utf-8');
        //remove the rtf tags if presentz
        if (text.startsWith('{\\rtf')) {
          text = text
            .replace(/\{\\rtf[\d]+.*?\}/, '')
            .replace(/\{[^}]*\}/g, '')
            .replace(/\\[a-zA-Z]+[\d]*\s?/g, ' ')
            .replace(/\\[^a-zA-Z]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        }
        
        return text.replace(/\s+/g, ' ').trim();
      } catch (error) {
        throw new Error(`Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    default:
      throw new Error(`Unsupported file type: ${extension}`);
  }
};

const countWords = (text: string): number => {
  return text.split(/\s+/).filter(word => word.length > 0).length;
};

const generateAudioChunk = async (text: string, voiceId: string): Promise<Buffer> => {
  const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
  if (!ELEVENLABS_API_KEY) {
    throw new Error('ElevenLabs API key not configured');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Accept': 'audio/mpeg',
      'Content-Type': 'application/json',
      'xi-api-key': ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.5,
        style: 0.0,
        use_speaker_boost: true
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs API error ${response.status}: ${errorText}`);
  }

  const audioBuffer = await response.arrayBuffer();
  return Buffer.from(audioBuffer);
};

const app = new Elysia()
.use(cors({
  origin: true,
  credentials: false
}))
.get('/', () => {
  return { message: 'Server is running!' };
})

// Check user file count and limit
.get('/user/:userId/file-stats', async ({ params }) => {
  const user = await ensureUser(params.userId);

  return { 
    fileCount: user.fileCount,
    fileLimit: FILE_LIMIT,
    canUpload: user.fileCount < FILE_LIMIT
  };
}, {
  params: t.Object({
    userId: t.String()
  })
})

.get('/upload/url', async ({ query }) => {
  // Check if user can upload more files
  const user = await ensureUser(query.userId);

  if (user.fileCount >= FILE_LIMIT) {
    throw new Error(`File limit reached. Maximum ${FILE_LIMIT} files allowed.`);
  }

  // Validate file type
  const extension = query.filename.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['pdf', 'txt'];
  
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error(`Invalid file type. Only PDF and TXT files are allowed. Received: ${extension || 'unknown'}`);
  }

  // Validate file size
  const fileSize = parseInt(query.size);
  if (isNaN(fileSize) || fileSize <= 0) {
    throw new Error('Invalid file size provided.');
  }
  
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size allowed is ${MAX_FILE_SIZE / (1024 * 1024)}MB. File size: ${(fileSize / (1024 * 1024)).toFixed(1)}MB`);
  }

  // Generate a unique key to avoid conflicts
  const timestamp = Date.now();
  const sanitizedFilename = query.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  const key = `${query.userId}/${timestamp}_${sanitizedFilename}`;
  
  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    ContentType: query.type,
  });
  const url = await getSignedUrl(s3, command, { expiresIn: 60 });
  return { url, key };
}, {
  query: t.Object({
    filename: t.String(),
    type: t.String(),
    size: t.String(),
    userId: t.String()
  })
})

.post('/upload', async ({ body }) => {
  // Double-check file limit before inserting
  const user = await ensureUser(body.userId);

  if (user.fileCount >= FILE_LIMIT) {
    throw new Error(`File limit reached. Maximum ${FILE_LIMIT} files allowed.`);
  }

  // Validate file type again for security
  const extension = body.filename.split('.').pop()?.toLowerCase();
  const allowedExtensions = ['pdf', 'txt'];
  
  if (!extension || !allowedExtensions.includes(extension)) {
    throw new Error(`Invalid file type. Only PDF and TXT files are allowed. Received: ${extension || 'unknown'}`);
  }

  // Insert file record
  const result = await db.insert(files).values({
    filename: body.filename,
    key: body.key,
    userId: body.userId,
    createdAt: new Date(),
    updatedAt: new Date()
  }).returning();

  await db
    .update(users)
    .set({ fileCount: user.fileCount + 1 })
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

// Get parsed text content for a file
.get('/file/:id/parsed', async ({ params }) => {
  const file = await db
    .select()
    .from(files)
    .where(eq(files.id, params.id));

  if (!file[0]) {
    throw new Error('File not found');
  }

  const existingParsed = await db
    .select()
    .from(parsedFiles)
    .where(eq(parsedFiles.fileId, file[0].id));

  if (existingParsed[0]) {
    return {
      file: file[0],
      parsedText: existingParsed[0].parsedText,
      wordCount: existingParsed[0].wordCount,
      cached: true
    };
  }

  // Parse the file for the first time
  try {
    // Download file from S3
    const fileBuffer = await downloadFileFromS3(file[0].key);
    
    const parsedText = await parseFileContent(fileBuffer, file[0].filename);
    const wordCount = countWords(parsedText);

    // Cache the parsed content
    const savedParsed = await db.insert(parsedFiles).values({
      fileId: file[0].id,
      parsedText,
      wordCount,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();

    if (!savedParsed[0]) {
      throw new Error('Failed to save parsed content');
    }

    return {
      file: file[0],
      parsedText: savedParsed[0].parsedText,
      wordCount: savedParsed[0].wordCount,
      cached: false
    };
  } catch (error) {
    throw new Error(`Failed to parse file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}, {
  params: t.Object({
    id: t.String()
  })
})

.get('/file/open/:key', async ({ params }) => {
  const file = await db
    .select()
    .from(files)
    .where(eq(files.key, params.key));

  if (!file[0]){
    throw new Error('File not found');
  }

  return { file: file[0] };
})

.get('/file/:id/audio/:chunkIndex', async ({ params }) => {
  const chunk = await db
    .select()
    .from(audioChunks)
    .where(and(
      eq(audioChunks.fileId, params.id),
      eq(audioChunks.chunkIndex, parseInt(params.chunkIndex))
    ));

  if (!chunk[0]) {
    throw new Error('Audio chunk not found');
  }

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: chunk[0].audioKey
  });
  
  const response = await s3.send(command);
  const stream = response.Body as any;
  
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  
  return new Response(Buffer.concat(chunks), {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Content-Length': Buffer.concat(chunks).length.toString()
    }
  });
}, {
  params: t.Object({
    id: t.String(),
    chunkIndex: t.String()
  })
})

.post('/file/:id/audio/generate', async ({ params, body }) => {
  const file = await db
    .select()
    .from(files)
    .where(eq(files.id, params.id));

  if (!file[0]) {
    throw new Error('File not found');
  }

  const parsedFile = await db
    .select()
    .from(parsedFiles)
    .where(eq(parsedFiles.fileId, file[0].id));

  if (!parsedFile[0]) {
    throw new Error('Parsed file not found');
  }

  const words = parsedFile[0].parsedText.split(/\s+/).filter(Boolean);
  const startIndex = body.startWordIndex;
  const endIndex = Math.min(startIndex + 200, words.length);
  const chunkText = words.slice(startIndex, endIndex).join(' ');

  if (!chunkText.trim()) {
    throw new Error('No text to generate audio for');
  }

  const existingChunk = await db
    .select()
    .from(audioChunks)
    .where(and(
      eq(audioChunks.fileId, file[0].id),
      eq(audioChunks.chunkIndex, body.chunkIndex),
      eq(audioChunks.voiceId, body.voiceId)
    ));

  if (existingChunk[0]) {
    return { 
      chunkIndex: body.chunkIndex,
      startWordIndex: startIndex,
      endWordIndex: endIndex,
      cached: true
    };
  }

  const audioBuffer = await generateAudioChunk(chunkText, body.voiceId);
  
  const audioKey = `${file[0].userId}/audio/${file[0].id}_chunk_${body.chunkIndex}_${body.voiceId}.mp3`;
  
  const uploadCommand = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: audioKey,
    Body: audioBuffer,
    ContentType: 'audio/mpeg'
  });
  
  await s3.send(uploadCommand);

  await db.insert(audioChunks).values({
    fileId: file[0].id,
    chunkIndex: body.chunkIndex,
    startWordIndex: startIndex,
    endWordIndex: endIndex,
    audioKey,
    voiceId: body.voiceId,
    createdAt: new Date()
  });

  return {
    chunkIndex: body.chunkIndex,
    startWordIndex: startIndex,
    endWordIndex: endIndex,
    cached: false
  };
}, {
  params: t.Object({
    id: t.String()
  }),
  body: t.Object({
    chunkIndex: t.Number(),
    startWordIndex: t.Number(),
    voiceId: t.String()
  })
})

// Delete a file from S3 and DB
.delete('/file', async ({ query }) => {
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


