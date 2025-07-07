'use client';

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { AuthNav } from "../../components/auth-nav"
import { Footer } from "../../components/footer"

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [files, setFiles] = useState<any[]>([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/")
      return
    }
  }, [session, status, router])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      // Implement actual file upload to backend, simulate for now
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const newFile = {
        id: Date.now(),
        name: file.name,
        size: file.size,
        uploadedAt: new Date().toISOString()
      }
      
      setFiles(prev => [...prev, newFile])
    } catch (error) {
      console.error('Upload failed:', error)
    } finally {
      setUploading(false)
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


        {/* Welcome Card */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-semibold text-slate-12 mb-2">
            Welcome back, {session.user?.name}!
          </h2>
          <p className="text-slate-12/80 text-pretty">
            Upload your documents to start speed-reading with TurboRead.
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 mb-8">
          <h3 className="text-xl font-semibold text-slate-12 mb-4">Upload Files</h3>
          <div className="border-2 border-dashed border-white/30 rounded-lg p-8 text-center">
            <input
              type="file"
              onChange={handleFileUpload}
              disabled={uploading}
              className="hidden"
              id="file-upload"
              accept=".pdf,.doc,.docx,.txt"
            />
            <label
              htmlFor="file-upload"
              className={`cursor-pointer inline-flex items-center px-6 py-3 rounded-lg font-medium text-slate-12 transition-colors ${
                uploading 
                  ? 'bg-gray-500 cursor-not-allowed' 
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {uploading ? 'Uploading...' : 'Choose File to Upload'}
            </label>
            <p className="text-slate-12/60 mt-2 text-sm">
              Supports PDF, DOC, DOCX, and TXT files
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
                      <svg className="w-5 h-5 text-slate-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="text-slate-12 font-medium">{file.name}</h4>
                      <p className="text-slate-12/60 text-sm">
                        {(file.size / 1024 / 1024).toFixed(2)} MB • {new Date(file.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-slate-12 rounded-lg transition-colors">
                    Open
                  </button>
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