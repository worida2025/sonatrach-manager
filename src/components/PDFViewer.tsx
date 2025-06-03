
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, RotateCw, Download, FileText } from 'lucide-react'

interface PDFViewerProps {
  file: File | null
  onDataExtracted: (data: Record<string, string>) => void
}

export function PDFViewer({ file, onDataExtracted }: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPdfUrl(url)
      
      // Mock data extraction - in real app, this would use PDF parsing
      const mockExtractedData = {
        'Document Title': file.name,
        'File Size': `${(file.size / 1024 / 1024).toFixed(2)} MB`,
        'Upload Date': new Date().toLocaleDateString(),
        'Document Type': 'Technical Specification',
        'Version': '1.0',
        'Status': 'Active',
        'Department': 'Engineering',
        'Last Modified': new Date().toLocaleDateString()
      }
      
      onDataExtracted(mockExtractedData)
      
      return () => URL.revokeObjectURL(url)
    } else {
      setPdfUrl(null)
    }
  }, [file, onDataExtracted])

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50))
  const handleRotate = () => setRotation(prev => (prev + 90) % 360)

  if (!file) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">PDF Preview</span>
            <span className="sm:hidden">Preview</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
            <p className="text-sm sm:text-base">No PDF selected</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">PDF Preview</span>
            <span className="sm:hidden">Preview</span>
          </CardTitle>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
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
              variant="outline"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
              className="h-7 w-7 p-0 sm:h-8 sm:w-8"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRotate}
              className="h-7 w-7 p-0 sm:h-8 sm:w-8"
            >
              <RotateCw className="h-3 w-3" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="h-7 w-7 p-0 sm:h-8 sm:w-8"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-4">
        <div className="h-full border rounded-lg bg-gray-50 overflow-auto">
          {pdfUrl ? (
            <div className="p-2 sm:p-4 flex justify-center h-full min-h-[30vh]">
              <iframe
                src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                className="border-0 rounded max-w-full"
                style={{
                  width: `${Math.max(zoom, 100)}%`,
                  height: '100%',
                  transform: `rotate(${rotation}deg)`,
                  transformOrigin: 'center center',
                  minWidth: '200px',
                  minHeight: '40vh'
                }}
                title="PDF Preview"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[30vh] text-center text-muted-foreground p-4">
              <div>
                <FileText className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
                <p className="text-sm sm:text-base font-medium mb-2">Loading PDF...</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
