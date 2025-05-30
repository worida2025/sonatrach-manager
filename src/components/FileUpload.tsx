
import { useCallback, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Upload, FileText, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { apiService } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  onDataExtracted: (data: Record<string, string>) => void
  selectedFile: File | null
  className?: string
}

export function FileUpload({ onFileSelect, onDataExtracted, selectedFile, className }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const handleFileUpload = async (file: File) => {
    setIsUploading(true)
    try {
      const response = await apiService.uploadPdf(file)
      onFileSelect(file)
      onDataExtracted(response.extracted_data)
      
      toast({
        title: "Upload Successful",
        description: `${file.name} has been processed successfully`,
      })
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "An error occurred during upload",
        variant: "destructive",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const pdfFile = files.find(file => file.type === 'application/pdf')
    
    if (pdfFile) {
      handleFileUpload(pdfFile)
    }
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      handleFileUpload(file)
    }
  }

  const removeFile = () => {
    onFileSelect(null as any)
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardContent className="p-6">
        {selectedFile ? (
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <p className="font-medium text-sm">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={removeFile}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              isDragOver 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            )}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Upload PDF Document</h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop your PDF file here, or click to browse
            </p>            <Button variant="outline" className="relative" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                "Choose File"
              )}
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileInput}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                disabled={isUploading}
              />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
