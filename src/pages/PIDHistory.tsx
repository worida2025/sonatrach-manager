import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { UploadHistory } from '@/components/UploadHistory'
import { History, FileText, ArrowLeft, Upload } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiService, type Document } from '@/lib/api'

interface HistoryItem {
  id: string
  fileName: string
  uploadDate: string
  fileSize: string
  uploadedBy: string
  status: 'processed' | 'processing' | 'failed'
  documentType: string
}

const PIDHistory = () => {  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<HistoryItem | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      setLoading(true)
      const response = await apiService.getDocuments()
      
      // Convert to history format
      const historyItems: HistoryItem[] = response.documents.map(doc => ({
        id: doc.id,
        fileName: doc.filename,
        uploadDate: new Date(doc.upload_date).toLocaleDateString(),
        fileSize: `${(doc.file_size / 1024 / 1024).toFixed(2)} MB`,
        uploadedBy: 'Current User',
        status: doc.status,
        documentType: 'PID'
      }))
      setHistory(historyItems)
    } catch (error) {
      toast({
        title: "Error Loading Documents",
        description: "Failed to load document history",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }
  const handleViewHistoryItem = (item: HistoryItem) => {
    navigate(`/pid/document/${item.id}`)
  }

  const handleDeleteRequest = (item: HistoryItem) => {
    setDocumentToDelete(item)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!documentToDelete) return
    
    try {
      setIsDeleting(true)
      await apiService.deleteDocument(documentToDelete.id)
      
      // Remove the document from the history
      setHistory(prev => prev.filter(item => item.id !== documentToDelete.id))
      
      toast({
        title: "Document Deleted",
        description: `${documentToDelete.fileName} has been successfully deleted`,
      })
    } catch (error) {
      toast({
        title: "Error Deleting Document",
        description: error instanceof Error ? error.message : "Failed to delete document",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
    }
  }
  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setDocumentToDelete(null)
  }

  const handleDownload = async (item: HistoryItem) => {
    try {
      // Add document ID to downloading set
      setDownloadingIds(prev => new Set(prev).add(item.id))
      
      // Download the document
      const blob = await apiService.downloadDocument(item.id)
      
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = item.fileName
      document.body.appendChild(link)
      link.click()
      
      // Cleanup
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Download Started",
        description: `${item.fileName} is being downloaded`,
      })
    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download document",
        variant: "destructive",
      })
    } finally {
      // Remove document ID from downloading set
      setDownloadingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(item.id)
        return newSet
      })
    }
  }

  const handleBackToPID = () => {
    navigate('/pid')
  }

  const handleNewUpload = () => {
    navigate('/pid')
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">PID History</h1>
            <p className="text-muted-foreground">View and manage your uploaded PID documents</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleBackToPID}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to PID
          </Button>
          <Button
            onClick={handleNewUpload}
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            New Upload
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading documents...</div>
            </div>
          ) : (            <UploadHistory
              history={history}
              onView={handleViewHistoryItem}
              onDelete={handleDeleteRequest}
              onDownload={handleDownload}
              showDelete={true}
              downloadingIds={downloadingIds}
            />
          )}        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{documentToDelete?.fileName}"? This action cannot be undone.
              All extracted data and associated information will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeleteCancel} disabled={isDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default PIDHistory
