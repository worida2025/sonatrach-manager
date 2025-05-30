
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileUpload } from '@/components/FileUpload'
import { PDFViewer } from '@/components/PDFViewer'
import { DataExtraction } from '@/components/DataExtraction'
import { UploadHistory } from '@/components/UploadHistory'
import { DocumentViewer } from '@/components/DocumentViewer'
import { Upload, History, FileText, ArrowLeft } from 'lucide-react'
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

const PID = () => {
  const { id: documentId } = useParams()
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [extractedData, setExtractedData] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeTab, setActiveTab] = useState('upload')

  useEffect(() => {
    loadDocuments()
  }, [])

  useEffect(() => {
    if (documentId) {
      loadSpecificDocument(documentId)
      setActiveTab('view')
    }
  }, [documentId, documents])

  const loadSpecificDocument = async (docId: string) => {
    try {
      const document = documents.find(doc => doc.id === docId)
      if (document) {
        setSelectedDocument(document)
        setExtractedData(document.extracted_data)
      } else if (documents.length > 0) {
        // Document not found in current list, try to fetch from API
        const response = await apiService.getDocument(docId)
        setSelectedDocument(response.document)
        setExtractedData(response.document.extracted_data)
      }
    } catch (error) {
      toast({
        title: "Error Loading Document",
        description: "Failed to load the specified document",
        variant: "destructive",
      })
      navigate('/pid')
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [])

  const loadDocuments = async () => {
    try {
      const response = await apiService.getDocuments()
      setDocuments(response.documents)
      
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
    }
  }
  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    if (file) {
      setActiveTab('upload')
      toast({
        title: "File Selected",
        description: `${file.name} is ready for processing`,
      })
    }
  }

  const handleDataExtracted = (data: Record<string, string>) => {
    setExtractedData(data)
    // Reload documents after successful upload
    loadDocuments()
  }

  const handleSaveData = (data: Record<string, string>) => {
    // In a real app, this would save to the backend
    console.log('Saving data:', data)
    
    // Add to history
    if (selectedFile) {
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        uploadedBy: 'Current User',
        status: 'processed',
        documentType: 'PID'
      }
      setHistory(prev => [newHistoryItem, ...prev])
    }

    toast({
      title: "Data Saved",
      description: "Document data has been successfully saved",
    })
  }
  const handleViewHistoryItem = (item: HistoryItem) => {
    navigate(`/pid/document/${item.id}`)
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <FileText className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Process & Instrumentation Diagrams</h1>
          <p className="text-muted-foreground">Upload and manage PID documents with automated data extraction</p>
        </div>
      </div>      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className={`grid w-full ${documentId ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload & Process
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
          {documentId && (
            <TabsTrigger value="view" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              View Document
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="upload" className="space-y-6">          <FileUpload
            onFileSelect={handleFileSelect}
            onDataExtracted={handleDataExtracted}
            selectedFile={selectedFile}
          />

          {selectedFile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
              <DataExtraction
                data={extractedData}
                onSave={handleSaveData}
              />
              <PDFViewer
                file={selectedFile}
                onDataExtracted={handleDataExtracted}
              />
            </div>
          )}
        </TabsContent>        <TabsContent value="history" className="space-y-6">
          <UploadHistory
            history={history}
            onView={handleViewHistoryItem}
          />
        </TabsContent>

        {documentId && selectedDocument && (
          <TabsContent value="view" className="space-y-6">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="outline"
                onClick={() => navigate('/pid')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to History
              </Button>
              <div>
                <h2 className="text-xl font-semibold">{selectedDocument.filename}</h2>
                <p className="text-sm text-muted-foreground">
                  Uploaded: {new Date(selectedDocument.upload_date).toLocaleDateString()}
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
              <DataExtraction
                data={extractedData}
                onSave={handleSaveData}
                readOnly={true}
              />
              <DocumentViewer document={selectedDocument} />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export default PID
