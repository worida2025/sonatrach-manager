import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Download, Calendar, Database, ZoomIn, ZoomOut, RotateCw } from 'lucide-react'
import { Document, apiService } from '@/lib/api'
import { toast } from '@/hooks/use-toast'
import { useState, useEffect } from 'react'

interface DocumentViewerProps {
  document: Document
}

export function DocumentViewer({ document }: DocumentViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)

  useEffect(() => {
    loadPdfPreview()
  }, [document])

  const loadPdfPreview = async () => {
    try {
      setIsLoading(true)
      const blob = await apiService.downloadDocument(document.id)
      const url = window.URL.createObjectURL(blob)
      setPdfUrl(url)
    } catch (error) {
      console.error('Error loading PDF preview:', error)
      toast({
        title: "Preview Error",
        description: "Could not load PDF preview",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        window.URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [pdfUrl])
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  const handleDownload = async () => {
    try {
      const blob = await apiService.downloadDocument(document.id)
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = document.filename
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      toast({
        title: "Download Started",
        description: `${document.filename} is being downloaded`,
      })
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "Failed to download the document",
        variant: "destructive",
      })
    }
  }
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">Document Preview</span>
          <span className="sm:hidden">Preview</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-4 space-y-4">
        {/* Document Information */}
        <div className="flex-shrink-0 space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="font-medium text-sm sm:text-base truncate flex-1 min-w-0">
              {document.filename}
            </h3>
            <Badge className={`${getStatusColor(document.status)} flex-shrink-0 text-xs`}>
              {document.status}
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Uploaded:</span>
              <span className="truncate">{new Date(document.upload_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Size:</span>
              <span>{(document.file_size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>

          <Button
            onClick={handleDownload}
            className="w-full flex items-center gap-2"
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Download Document</span>
            <span className="sm:hidden">Download</span>
          </Button>
        </div>

        {/* Document Preview Area */}
        <div className="flex-1 overflow-hidden flex flex-col space-y-2">
          <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h4 className="font-medium text-xs sm:text-sm">PDF Preview</h4>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
                className="h-7 w-7 p-0 sm:h-8 sm:w-8"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-8 sm:min-w-12 text-center">
                {zoom}%
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
                className="h-7 w-7 p-0 sm:h-8 sm:w-8"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRotate}
                className="h-7 w-7 p-0 sm:h-8 sm:w-8"
              >
                <RotateCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="flex-1 border rounded-lg bg-gray-50 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full min-h-[200px] sm:min-h-[300px]">
                <div className="text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-xs sm:text-sm">Loading PDF preview...</p>
                </div>
              </div>
            ) : pdfUrl ? (
              <div className="p-2 sm:p-4 flex justify-center h-full">
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="border-0 rounded max-w-full"
                  style={{
                    width: `${Math.max(zoom, 100)}%`,
                    height: '100%',
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    minWidth: '200px',
                    minHeight: '300px'
                  }}
                  title={`Preview of ${document.filename}`}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full min-h-[200px] sm:min-h-[300px] text-center text-muted-foreground p-4">
                <div>
                  <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-sm sm:text-lg font-medium mb-2">Preview Unavailable</p>
                  <p className="text-xs sm:text-sm">
                    Unable to load PDF preview.<br />
                    Click "Download Document" to view the full file.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Data Summary */}
        <div className="flex-shrink-0 space-y-2">
          <h4 className="font-medium text-xs sm:text-sm">Extracted Fields</h4>
          <div className="text-xs sm:text-sm text-muted-foreground">
            {Object.keys(document.extracted_data).length} fields extracted from this document
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
