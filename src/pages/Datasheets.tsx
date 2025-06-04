
import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DocumentProcessor from '@/components/DocumentProcessor'
import DatasheetList from '@/components/DatasheetList'
import DatasheetViewer from '@/components/DatasheetViewer'
import { Upload, Database, Eye } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

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

const Datasheets = () => {
  const [activeTab, setActiveTab] = useState('process')
  const [selectedDatasheetId, setSelectedDatasheetId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleProcessingComplete = (result: ProcessingResult) => {
    if (result.status === 'success') {
      toast({
        title: "Processing complete",
        description: `Successfully processed ${result.datasheets.length} datasheet${result.datasheets.length !== 1 ? 's' : ''}`,
      })
      
      // Switch to datasheets tab and refresh list
      setActiveTab('datasheets')
      setRefreshKey(prev => prev + 1)
    } else {
      toast({
        title: "Processing failed",
        description: result.message,
        variant: "destructive"
      })
    }
  }

  const handleViewDatasheet = (datasheetId: string) => {
    setSelectedDatasheetId(datasheetId)
    setActiveTab('viewer')
  }

  const handleCloseViewer = () => {
    setSelectedDatasheetId(null)
    setActiveTab('datasheets')
  }
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Technical Datasheets</h1>
          <p className="text-muted-foreground">
            Process documents to extract individual datasheets and chat with AI about technical specifications
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="process" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Process Document
          </TabsTrigger>
          <TabsTrigger value="datasheets" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Datasheets
          </TabsTrigger>
          <TabsTrigger value="viewer" className="flex items-center gap-2" disabled={!selectedDatasheetId}>
            <Eye className="h-4 w-4" />
            Viewer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="process" className="space-y-6">
          <DocumentProcessor onProcessingComplete={handleProcessingComplete} />
        </TabsContent>

        <TabsContent value="datasheets" className="space-y-6">
          <DatasheetList key={refreshKey} onViewDatasheet={handleViewDatasheet} />
        </TabsContent>

        <TabsContent value="viewer" className="space-y-6">
          {selectedDatasheetId ? (
            <DatasheetViewer 
              datasheetId={selectedDatasheetId} 
              onClose={handleCloseViewer}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No datasheet selected</p>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Datasheets
