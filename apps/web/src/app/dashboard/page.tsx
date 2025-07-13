'use client';

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FileText } from "lucide-react"
import { AuthNav } from "../../components/auth-nav"
import { Footer } from "../../components/footer"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const FILE_LIMIT = 2;
const MAX_FILE_SIZE = 20 * 1024 * 1024; 

interface FileStats {
  fileCount: number;
  fileLimit: number;
  canUpload: boolean;
}

interface FileData {
  id: string;
  filename: string;
  key: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [files, setFiles] = useState<FileData[]>([])
  const [fileStats, setFileStats] = useState<FileStats | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/")
      return
    }
    
    fetchFiles()
    fetchFileStats()
  }, [session, status, router])

  const fetchFileStats = async () => {
    if (!session?.user?.id) return
    
    try {
      const response = await fetch(`${API_BASE}/user/${session.user.id}/file-stats`)
      if (!response.ok) throw new Error('Failed to fetch file stats')
      const stats = await response.json()
      setFileStats(stats)
    } catch (error) {
      console.error('Error fetching file stats:', error)
    }
  }

  const fetchFiles = async () => {
    if (!session?.user?.id) return
    
    try {
      const response = await fetch(`${API_BASE}/files/${session.user.id}`)
      if (!response.ok) throw new Error('Failed to fetch files')
      const data = await response.json()
      setFiles(data.files)
    } catch (error) {
      console.error('Error fetching files:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !session?.user?.id) return

    // Check if user can upload
    if (!fileStats?.canUpload) {
      setError(`File limit reached! You can only upload ${fileStats?.fileLimit} files.`)
      return
    }

    const extension = file.name.split('.').pop()?.toLowerCase()
    const allowedExtensions = ['pdf', 'txt']
    
    if (!extension || !allowedExtensions.includes(extension)) {
      setError(`Invalid file type. Only PDF and TXT files are allowed. Selected file: ${file.name}`)
      e.target.value = ''
      return
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File too large. Maximum size allowed is ${MAX_FILE_SIZE / (1024 * 1024)}MB. File size: ${(file.size / (1024 * 1024)).toFixed(1)}MB`)
      e.target.value = ''
      return
    }

    setUploading(true)
    setError(null)
    
    try {
      // Get presigned URL
      const urlResponse = await fetch(
        `${API_BASE}/upload/url?filename=${encodeURIComponent(file.name)}&type=${encodeURIComponent(file.type)}&size=${file.size}&userId=${session.user.id}`
      )
      
      if (!urlResponse.ok) {
        const errorData = await urlResponse.text()
        throw new Error(errorData || 'Failed to get upload URL')
      }
      
      const { url, key } = await urlResponse.json()

      // Upload to S3
      const uploadResponse = await fetch(url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      })

      if (!uploadResponse.ok) throw new Error('Failed to upload file')

      // Save to database - use the key returned from backend
      const dbResponse = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: file.name,
          key: key,
          userId: session.user.id,
        }),
      })

      if (!dbResponse.ok) {
        const errorData = await dbResponse.text()
        throw new Error(errorData || 'Failed to save file metadata')
      }

      // Refresh data
      await fetchFiles()
      await fetchFileStats()
      
      e.target.value = ''
      
    } catch (error) {
      console.error('Upload failed:', error)
      setError(error instanceof Error ? error.message : 'Upload failed')
      e.target.value = ''
    } finally {
      setUploading(false)
    }
  }

  const handleFileDelete = async (fileKey: string) => {
    try {
      const response = await fetch(`${API_BASE}/file?key=${encodeURIComponent(fileKey)}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete file')

      // Refresh data
      await fetchFiles()
      await fetchFileStats()
    } catch (error) {
      console.error('Delete failed:', error)
      setError(error instanceof Error ? error.message : 'Delete failed')
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-10">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="w-full mx-auto max-w-[800px] flex flex-col bg-white/10 dark:bg-slate-900/50 backdrop-blur-md rounded-2xl shadow-2xl">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center mb-4">
            <div className="flex-1 text-left">
                <h1 className="text-3xl pl-8 font-bold text-slate-12 text-pretty">Dashboard</h1>
            </div>
            <div className="text-md text-right">
                <AuthNav className="gap-[2px]"/>
            </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 mb-4">
            <p className="text-red-200">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-300 hover:text-red-100 text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Welcome Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-slate-12 mb-2">
            Welcome back, {session.user?.name}!
          </h2>
          <p className="text-slate-12/80 text-pretty">
            Upload your documents to start speed-reading with TurboRead.
          </p>
          {fileStats && (
            <div className="mt-4 flex items-center gap-4">
              <div className="text-slate-12/80">
                <span className="font-medium">Files: {fileStats.fileCount}/{fileStats.fileLimit}</span>
              </div>
              <div className="flex-1 bg-white/20 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${(fileStats.fileCount / fileStats.fileLimit) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Upload Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8">
          <h3 className="text-xl font-semibold text-slate-12 mb-4">Upload Files</h3>
          <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center">
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading || !fileStats?.canUpload}
              className="hidden"
              id="file-upload"
              accept=".pdf,.txt"
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer inline-flex items-center px-6 py-3 rounded-lg font-medium text-slate-12 transition-colors ${
                uploading 
                  ? 'bg-gray-500 cursor-not-allowed' 
                  : !fileStats?.canUpload
                  ? 'bg-red-600/70 cursor-not-allowed'
                  : 'bg-purple-600/70 hover:bg-purple-700'
              }`}
            >
              {uploading 
                ? 'Uploading...' 
                : !fileStats?.canUpload 
                ? `Limit Reached (${FILE_LIMIT} files max)`
                : 'Choose File to Upload'
              }
            </label>
            <p className="text-slate-12/60 mt-2 text-sm">
              Supports PDF, and TXT files. Maximum 20MB per file.
            </p>
          </div>
        </div>

        {/* Files List */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-4">
          <h3 className="text-xl font-semibold text-slate-12 mb-4">Your Files</h3>
          {files.length === 0 ? (
            <div className="text-center py-8 text-slate-12/60">
              <p>No files uploaded yet. Upload your first document to get started!</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="bg-white/10 rounded-lg p-4 flex items-center justify-between hover:bg-white/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-slate-12" />
                    </div>
                    <div>
                      <h4 className="text-slate-12 font-medium">{file.filename}</h4>
                      <p className="text-slate-12/60 text-sm">
                        Uploaded {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => router.push(`/file/${file.id}`)}
                      className="px-4 py-2 bg-purple-600/70 hover:bg-purple-700 text-slate-12 rounded-lg transition-colors"
                    >
                      Open
                    </button>
                    <button 
                      onClick={() => handleFileDelete(file.key)}
                      className="px-4 py-2 bg-red-600/70 hover:bg-red-700 text-slate-12 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <Footer />
      </div>
    </div>
  )
}