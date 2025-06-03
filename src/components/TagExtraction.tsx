import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw, Tags, TrendingUp, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { apiService } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface TagExtractionProps {
  documentId?: string
  tagExtractionResult?: {
    status: string
    message: string
    tags: string[]
    new_acronyms: string[]
    file_key?: string
    total_words_analyzed?: number
  }
  onReprocess?: () => void
}

interface TagStats {
  total_files_processed: number
  total_instruments_found: number
  total_known_acronyms: number
  total_false_positives: number
}

interface DetailedTag {
  tag: string
  tag_less_unit: string
  accronyme: string
  datasheet: {
    file_id: string
    pages: any[]
  }
}

export function TagExtraction({ documentId, tagExtractionResult, onReprocess }: TagExtractionProps) {
  const [isReprocessing, setIsReprocessing] = useState(false)
  const [tagStats, setTagStats] = useState<TagStats | null>(null)
  const [detailedTags, setDetailedTags] = useState<DetailedTag[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [loadingTags, setLoadingTags] = useState(false)

  useEffect(() => {
    loadTagStats()
  }, [])

  useEffect(() => {
    if (documentId) {
      loadDocumentTags()
    }
  }, [documentId])

  const loadTagStats = async () => {
    setLoadingStats(true)
    try {
      const response = await apiService.getTagStats()
      setTagStats(response.stats)
    } catch (error) {
      console.error('Error loading tag stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const loadDocumentTags = async () => {
    if (!documentId) return
    
    setLoadingTags(true)
    try {
      const response = await apiService.getDocumentTags(documentId)
      setDetailedTags(response.detailed_tags || [])
    } catch (error) {
      console.error('Error loading document tags:', error)
    } finally {
      setLoadingTags(false)
    }
  }

  const handleReprocess = async () => {
    if (!documentId) return

    setIsReprocessing(true)
    try {
      const response = await apiService.reprocessDocumentTags(documentId)
      
      toast({
        title: "Tags Reprocessed",
        description: response.message,
      })

      // Reload tag data
      await loadDocumentTags()
      await loadTagStats()
      
      // Call parent callback if provided
      if (onReprocess) {
        onReprocess()
      }
    } catch (error) {
      toast({
        title: "Reprocessing Failed",
        description: error instanceof Error ? error.message : "Failed to reprocess tags",
        variant: "destructive",
      })
    } finally {
      setIsReprocessing(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      case 'already_processed':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50'
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'already_processed':
        return 'text-yellow-600 bg-yellow-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tags className="h-5 w-5" />
            <CardTitle>Tag Extraction</CardTitle>
          </div>
          {documentId && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReprocess}
              disabled={isReprocessing}
            >
              {isReprocessing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reprocess
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="results" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="results">Extraction Results</TabsTrigger>
            <TabsTrigger value="stats">Global Statistics</TabsTrigger>
          </TabsList>
          
          <TabsContent value="results" className="space-y-4">
            {tagExtractionResult ? (
              <div className="space-y-4">
                {/* Status Alert */}
                <Alert className={getStatusColor(tagExtractionResult.status)}>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(tagExtractionResult.status)}
                    <AlertDescription>
                      <strong>Status:</strong> {tagExtractionResult.status} - {tagExtractionResult.message}
                    </AlertDescription>
                  </div>
                </Alert>

                {/* Extraction Summary */}
                {tagExtractionResult.status === 'success' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <div className="text-sm text-blue-600 font-medium">Tags Found</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {tagExtractionResult.tags.length}
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg">
                      <div className="text-sm text-green-600 font-medium">New Acronyms</div>
                      <div className="text-2xl font-bold text-green-900">
                        {tagExtractionResult.new_acronyms.length}
                      </div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="text-sm text-purple-600 font-medium">Words Analyzed</div>
                      <div className="text-2xl font-bold text-purple-900">
                        {tagExtractionResult.total_words_analyzed || 0}
                      </div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg">
                      <div className="text-sm text-orange-600 font-medium">File Key</div>
                      <div className="text-lg font-bold text-orange-900">
                        {tagExtractionResult.file_key || 'N/A'}
                      </div>
                    </div>
                  </div>
                )}

                {/* Extracted Tags */}
                {tagExtractionResult.tags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Extracted Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {tagExtractionResult.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* New Acronyms */}
                {tagExtractionResult.new_acronyms.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">New Acronyms Discovered</h4>
                    <div className="flex flex-wrap gap-2">
                      {tagExtractionResult.new_acronyms.map((acronym, index) => (
                        <Badge key={index} variant="outline" className="border-green-200 text-green-700">
                          {acronym}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Tags */}
                {detailedTags.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Detailed Tag Information</h4>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {loadingTags ? (
                        <div className="text-center py-4 text-muted-foreground">Loading detailed tags...</div>
                      ) : (
                        detailedTags.map((tag, index) => (
                          <div key={index} className="bg-gray-50 p-3 rounded border">
                            <div className="font-medium">{tag.tag}</div>
                            <div className="text-sm text-muted-foreground">
                              Acronym: {tag.accronyme} | Tag (less unit): {tag.tag_less_unit}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No tag extraction results available
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="stats" className="space-y-4">
            {loadingStats ? (
              <div className="text-center py-8 text-muted-foreground">Loading statistics...</div>
            ) : tagStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-blue-600" />
                      <div className="text-sm text-blue-600 font-medium">Files Processed</div>
                    </div>
                    <div className="text-2xl font-bold text-blue-900">
                      {tagStats.total_files_processed}
                    </div>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Tags className="h-4 w-4 text-green-600" />
                      <div className="text-sm text-green-600 font-medium">Total Instruments</div>
                    </div>
                    <div className="text-2xl font-bold text-green-900">
                      {tagStats.total_instruments_found}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-purple-600" />
                      <div className="text-sm text-purple-600 font-medium">Known Acronyms</div>
                    </div>
                    <div className="text-2xl font-bold text-purple-900">
                      {tagStats.total_known_acronyms}
                    </div>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      <div className="text-sm text-red-600 font-medium">False Positives</div>
                    </div>
                    <div className="text-2xl font-bold text-red-900">
                      {tagStats.total_false_positives}
                    </div>
                  </div>
                </div>
                
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    These statistics are cumulative across all processed documents in the system.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No statistics available
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
