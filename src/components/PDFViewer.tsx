
import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ZoomIn, ZoomOut, RotateCw, Download } from 'lucide-react'

interface PDFViewerProps {
  file: File | null
  onDataExtracted: (data: Record<string, string>) => void
}

export function PDFViewer({ file, onDataExtracted }: PDFViewerProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
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
  }, [file])

  if (!pdfUrl) {
    return (
      <Card className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No PDF selected</p>
      </Card>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="font-semibold">PDF Preview</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.25))}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium">{Math.round(zoom * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(2, zoom + 0.25))}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <RotateCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <iframe
          src={pdfUrl}
          className="w-full h-full border rounded"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          title="PDF Preview"
        />
      </div>
    </Card>
  )
}
