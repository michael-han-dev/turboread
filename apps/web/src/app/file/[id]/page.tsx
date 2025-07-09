'use client';

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Book } from "lucide-react";

interface FileData {
  id: string;
  filename: string;
  key: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

interface FileResponse {
  file: FileData;
  downloadUrl: string;
}

export default function FilePage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  const [fileData, setFileData] = useState<FileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileId = params.id as string;

  useEffect(() => {
    if (!session) {
      router.push("/");
      return;
    }

    const fetchFile = async () => {
      try {
        const response = await fetch(`http://localhost:3001/file/${fileId}`);
        if (!response.ok) throw new Error('File not found');
        const data = await response.json();
        setFileData(data);
      } catch (error) {
        console.error('Error fetching file:', error);
        setError(error instanceof Error ? error.message : 'Failed to load file');
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [fileId, session, router]);

  const getFileType = (filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase();
    return extension;
  };

  const renderFileContent = () => {
    if (!fileData) return null;

    const fileType = getFileType(fileData.file.filename);
    const { downloadUrl } = fileData;

    switch (fileType) {
      case 'pdf':
        return (
          <iframe
            src={downloadUrl}
            className="w-full h-full"
            title={fileData.file.filename}
            style={{ height: 'calc(100vh - 73px)' }}
          />
        );
      case 'txt':
        return (
          <iframe
            src={downloadUrl}
            className="w-full h-full border-0 bg-white p-4"
            title={fileData.file.filename}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-900">
        <div className="text-slate-12 text-lg">Loading file...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-slate-900 to-indigo-900">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">{error}</div>
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-md border-b border-white/20">
        <div className="mx-auto px-4 py-4 flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-semibold text-slate-12">{fileData?.file.filename}</h1>
              <p className="text-slate-12/60 text-sm">
                Uploaded {new Date(fileData?.file.createdAt || '').toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="px-4 py-2 bg-purple-600/70 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Book className="w-4 h-4" />
              Read
            </button>
          </div>
        </div>
      </div>

      {/* File Content */}
      <div className="flex-1">
        {renderFileContent()}
      </div>
    </div>
  );
} 