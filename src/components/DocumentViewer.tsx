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
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Document Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Document Information */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{document.filename}</h3>
            <Badge className={getStatusColor(document.status)}>
              {document.status}
            </Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Uploaded:</span>
              <span>{new Date(document.upload_date).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Size:</span>
              <span>{(document.file_size / 1024 / 1024).toFixed(2)} MB</span>
            </div>
          </div>

          <Button
            onClick={handleDownload}
            className="w-full flex items-center gap-2"
            variant="outline"
          >
            <Download className="h-4 w-4" />
            Download Document
          </Button>
        </div>        {/* Document Preview Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">PDF Preview</h4>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomOut}
                disabled={zoom <= 50}
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-12 text-center">
                {zoom}%
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleZoomIn}
                disabled={zoom >= 200}
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleRotate}
              >
                <RotateCw className="h-3 w-3" />
              </Button>
            </div>
          </div>
          
          <div className="border rounded-lg bg-gray-50 min-h-[400px] overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-[400px]">
                <div className="text-center text-muted-foreground">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p>Loading PDF preview...</p>
                </div>
              </div>
            ) : pdfUrl ? (
              <div className="p-4 flex justify-center">
                <iframe
                  src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  className="border-0 rounded"
                  style={{
                    width: `${zoom}%`,
                    height: '500px',
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'center center',
                    minWidth: '300px'
                  }}
                  title={`Preview of ${document.filename}`}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-[400px] text-center text-muted-foreground">
                <div>
                  <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Preview Unavailable</p>
                  <p className="text-sm">
                    Unable to load PDF preview.<br />
                    Click "Download Document" to view the full file.
                  </p>
                </div>
              </div>
            )}          </div>
        </div>

        {/* Data Summary */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Extracted Fields</h4>
          <div className="text-sm text-muted-foreground">
            {Object.keys(document.extracted_data).length} fields extracted from this document
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
