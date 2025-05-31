import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileUpload } from '@/components/FileUpload'
import { PDFViewer } from '@/components/PDFViewer'
import { DataExtraction } from '@/components/DataExtraction'
import { DocumentViewer } from '@/components/DocumentViewer'
import { DocumentChat } from '@/components/DocumentChat'
import { Upload, History, FileText, ArrowLeft } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { apiService, type Document } from '@/lib/api'

const PID = () => {
  const { id: documentId } = useParams()
  const navigate = useNavigate()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [extractedData, setExtractedData] = useState<Record<string, string>>({})
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
    } catch (error) {
      toast({
        title: "Error Loading Documents",
        description: "Failed to load documents",
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
    }  }

  const handleFieldsExtracted = (newFields: Record<string, string>) => {
    setExtractedData(prev => ({ ...prev, ...newFields }))
    
    // Save the updated fields to the backend if we have a document
    if (selectedDocument) {
      handleSaveData({ ...extractedData, ...newFields })
    }
  }

  const handleFieldDelete = async (fieldKey: string) => {
    if (!selectedDocument) return
    
    try {
      await apiService.deleteField(selectedDocument.id, fieldKey)
      
      // Update local state
      setExtractedData(prev => {
        const updated = { ...prev }
        delete updated[fieldKey]
        return updated
      })
      
      toast({
        title: "Field Deleted",
        description: `Field "${fieldKey}" has been deleted successfully`,
      })
    } catch (error) {
      toast({
        title: "Error Deleting Field",
        description: error instanceof Error ? error.message : "Failed to delete field",
        variant: "destructive",
      })
    }
  }
  const handleDataExtracted = (data: Record<string, string>) => {
    setExtractedData(data)
    // Reload documents after successful upload
    loadDocuments()
  }
  
  const handleSaveData = async (data: Record<string, string>) => {
    try {
      if (selectedDocument) {
        // Update existing document
        await apiService.updateDocumentData(selectedDocument.id, data)
        setExtractedData(data)
        toast({
          title: "Data Saved",
          description: "Document data has been successfully updated",
        })
      } else if (selectedFile) {
        // For new files, just update local state
        console.log('Saving data for new file:', data)
        
        toast({
          title: "Data Saved",
          description: "Document data has been successfully saved",        })
      }
    } catch (error) {
      toast({
        title: "Save Error",
        description: "Failed to save document data",
        variant: "destructive",
      })
    }
  }

  const handleUploadSuccess = (documentId: string) => {
    // Navigate to the document view page after successful upload
    navigate(`/pid/document/${documentId}`)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header Section */}
      <div className="flex-shrink-0 p-4 sm:p-6 border-b bg-background">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold truncate">
                Process & Instrumentation Diagrams
              </h1>
              <p className="text-sm text-muted-foreground hidden sm:block">
                Upload and manage PID documents with automated data extraction
              </p>
            </div>
          </div>
          {!documentId && (
            <Button
              variant="outline"
              onClick={() => navigate('/pid/history')}
              className="flex items-center gap-2 flex-shrink-0"
              size="sm"
            >
              <History className="h-4 w-4" />
              <span className="hidden sm:inline">View History</span>
              <span className="sm:hidden">History</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">
        {documentId && selectedDocument ? (
          // Document view - responsive layout
          <div className="h-full flex flex-col">
            {/* Document Header */}
            <div className="flex-shrink-0 p-4 sm:p-6 border-b bg-background">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <Button
                  variant="outline"
                  onClick={() => navigate('/pid/history')}
                  className="flex items-center gap-2 self-start"
                  size="sm"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back to History</span>
                  <span className="sm:hidden">Back</span>
                </Button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl font-semibold truncate">
                    {selectedDocument.filename}
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Uploaded: {new Date(selectedDocument.upload_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Document Content Grid */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full grid grid-cols-1 xl:grid-cols-2 gap-4 p-4 sm:p-6">
                {/* Left Panel - Document Preview and Data */}
                <div className="h-full flex flex-col min-h-0">
                  <Tabs defaultValue="preview" className="h-full flex flex-col">
                    <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
                      <TabsTrigger value="preview" className="text-xs sm:text-sm">
                        <span className="hidden sm:inline">Document Preview</span>
                        <span className="sm:hidden">Preview</span>
                      </TabsTrigger>
                      <TabsTrigger value="data" className="text-xs sm:text-sm">
                        <span className="hidden sm:inline">Extracted Data</span>
                        <span className="sm:hidden">Data</span>
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="preview" className="flex-1 mt-4 overflow-hidden min-h-0">
                      <DocumentViewer document={selectedDocument} />
                    </TabsContent>
                    
                    <TabsContent value="data" className="flex-1 mt-4 overflow-hidden min-h-0">
                      <DataExtraction
                        data={extractedData}
                        onSave={handleSaveData}
                        onFieldDelete={handleFieldDelete}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
                
                {/* Right Panel - Document Chat */}
                <div className="h-full min-h-0">
                  <DocumentChat
                    key={selectedDocument.id}
                    documentId={selectedDocument.id}
                    onFieldsExtracted={handleFieldsExtracted}
                  />
                </div>
              </div>
            </div>
          </div>        ) : (
          // Upload process - responsive layout
          <div className="h-full overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
              <div className="flex-shrink-0 p-4 sm:p-6">
                <TabsList className="grid w-full grid-cols-1 max-w-md">
                  <TabsTrigger value="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload & Process</span>
                    <span className="sm:hidden">Upload</span>
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="upload" className="flex-1 overflow-hidden px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="h-full flex flex-col gap-4 sm:gap-6">
                  <div className="flex-shrink-0">
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      onDataExtracted={handleDataExtracted}
                      selectedFile={selectedFile}
                      onUploadSuccess={handleUploadSuccess}
                    />
                  </div>

                  {selectedFile && (
                    <div className="flex-1 overflow-hidden min-h-0">
                      <div className="h-full grid grid-cols-1 xl:grid-cols-2 gap-4 sm:gap-6">
                        <div className="h-full min-h-0">
                          <DataExtraction
                            data={extractedData}
                            onSave={handleSaveData}
                            onFieldDelete={handleFieldDelete}
                          />
                        </div>
                        <div className="h-full min-h-0">
                          <PDFViewer
                            file={selectedFile}
                            onDataExtracted={handleDataExtracted}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}

export default PID
