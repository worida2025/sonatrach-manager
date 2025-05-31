
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileText, Calendar, User, Download, Eye, Trash2 } from 'lucide-react'

interface HistoryItem {
  id: string
  fileName: string
  uploadDate: string
  fileSize: string
  uploadedBy: string
  status: 'processed' | 'processing' | 'failed'
  documentType: string
}

interface UploadHistoryProps {
  history: HistoryItem[]
  onView: (item: HistoryItem) => void
  onDelete?: (item: HistoryItem) => void
  onDownload?: (item: HistoryItem) => void
  showDelete?: boolean
  downloadingIds?: Set<string>
}

export function UploadHistory({ history, onView, onDelete, onDownload, showDelete = false, downloadingIds = new Set() }: UploadHistoryProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'processed': return 'bg-green-100 text-green-800'
      case 'processing': return 'bg-yellow-100 text-yellow-800'
      case 'failed': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload History
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {history.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No uploads yet. Upload your first document to get started.
          </p>
        ) : (
          history.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-sm mb-1">{item.fileName}</h4>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {item.uploadDate}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {item.uploadedBy}
                    </span>
                  </div>
                </div>
                <Badge className={getStatusColor(item.status)}>
                  {item.status}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  <span>{item.fileSize}</span> • <span>{item.documentType}</span>
                </div>                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onView(item)}
                    className="h-8 px-2"
                  >
                    <Eye className="h-3 w-3" />
                  </Button>                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDownload ? onDownload(item) : undefined}
                    disabled={!onDownload || downloadingIds.has(item.id)}
                    className="h-8 px-2"
                  >
                    <Download className="h-3 w-3" />
                    {downloadingIds.has(item.id) && (
                      <span className="ml-1 text-xs">...</span>
                    )}
                  </Button>
                  {showDelete && onDelete && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDelete(item)}
                      className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </CardContent>
    </Card>
  )
}
