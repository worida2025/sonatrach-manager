import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { 
  Upload, 
  FileText, 
  Zap, 
  CheckCircle,
  AlertCircle,
  Loader2,
  Database
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { useDropzone } from 'react-dropzone'

interface ProcessedDatasheet {
  id: string
  equipment_name: string
  pages: string
  fields_found: number
}

interface ProcessingResult {
  status: string
  message: string
  document_id?: string
  datasheets: ProcessedDatasheet[]
}

interface DocumentProcessorProps {
  onProcessingComplete: (result: ProcessingResult) => void
}

const DocumentProcessor: React.FC<DocumentProcessorProps> = ({ onProcessingComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [processingStage, setProcessingStage] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      toast({
        title: "File selected",
        description: `${file.name} is ready for processing`
      })
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select a PDF file",
        variant: "destructive"
      })
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  })

  const processDocument = async () => {
    if (!selectedFile) return

    try {
      setProcessing(true)
      setProgress(0)
      setProcessingStage('Uploading document...')

      const formData = new FormData()
      formData.append('file', selectedFile)

      // Simulate progress updates
      const progressInterval = setInterval(() => {        setProgress(prev => {
          if (prev < 80) return prev + 10
          return prev        })
      }, 500)

      setProcessingStage('Analyzing document structure...')

      const response = await fetch(`http://localhost:8001/datasheets/process/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      })

      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error('Failed to process document')
      }

      setProcessingStage('Extracting datasheets...')
      setProgress(90)

      const result = await response.json()
      
      setProgress(100)
      setProcessingStage('Processing complete!')

      setTimeout(() => {
        toast({
          title: "Processing complete",
          description: `Found ${result.datasheets.length} datasheet${result.datasheets.length !== 1 ? 's' : ''}`
        })
        onProcessingComplete(result)
        
        // Reset state
        setSelectedFile(null)
        setProcessing(false)
        setProgress(0)
        setProcessingStage('')
      }, 1000)

    } catch (error) {
      console.error('Error processing document:', error)
      setProcessing(false)
      setProgress(0)
      setProcessingStage('')
      
      toast({
        title: "Processing failed",
        description: "An error occurred while processing the document",
        variant: "destructive"
      })
    }
  }

  const removeFile = () => {
    setSelectedFile(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Document Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Upload Area */}
          {!selectedFile ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
              `}
            >
              <input {...getInputProps()} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {isDragActive ? 'Drop the PDF here' : 'Upload PDF Document'}
              </h3>
              <p className="text-muted-foreground mb-4">
                Drag and drop a PDF file here, or click to select
              </p>
              <p className="text-sm text-muted-foreground">
                The document will be automatically split into individual datasheets
              </p>
            </div>
          ) : (
            /* Selected File Display */
            <div className="border rounded-lg p-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-primary" />
                  <div>
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                {!processing && (
                  <Button variant="outline" size="sm" onClick={removeFile}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Processing Status */}
          {processing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm font-medium">{processingStage}</span>
              </div>
              <Progress value={progress} className="w-full" />
              <p className="text-xs text-muted-foreground">
                This may take a few moments depending on document size...
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {selectedFile ? 'Ready to process' : 'Select a PDF file to begin'}
            </div>
            <Button
              onClick={processDocument}
              disabled={!selectedFile || processing}
              className="min-w-[120px]"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing
                </>
              ) : (
                <>
                  <Database className="h-4 w-4 mr-2" />
                  Process Document
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Processing Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How Document Processing Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Upload className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">1. Upload</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your PDF document containing multiple datasheets
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">2. Process</h3>
                <p className="text-sm text-muted-foreground">
                  AI analyzes and splits the document into individual datasheets
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-1">3. Extract</h3>
                <p className="text-sm text-muted-foreground">
                  Technical fields are extracted and each datasheet becomes searchable
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default DocumentProcessor
