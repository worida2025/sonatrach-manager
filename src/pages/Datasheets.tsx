
import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FileUpload } from '@/components/FileUpload'
import { PDFViewer } from '@/components/PDFViewer'
import { DataExtraction } from '@/components/DataExtraction'
import { UploadHistory } from '@/components/UploadHistory'
import { Upload, History, Database } from 'lucide-react'
import { toast } from '@/hooks/use-toast'

interface HistoryItem {
  id: string
  fileName: string
  uploadDate: string
  fileSize: string
  uploadedBy: string
  status: 'processed' | 'processing' | 'failed'
  documentType: string
}

const Datasheets = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [extractedData, setExtractedData] = useState<Record<string, string>>({})
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [activeTab, setActiveTab] = useState('upload')

  useEffect(() => {
    // Load mock history data for datasheets
    const mockHistory: HistoryItem[] = [
      {
        id: '1',
        fileName: 'Pump_Specifications_XYZ123.pdf',
        uploadDate: '2024-05-21',
        fileSize: '3.2 MB',
        uploadedBy: 'Engineering Team',
        status: 'processed',
        documentType: 'Datasheet'
      },
      {
        id: '2',
        fileName: 'Valve_Technical_Data_ABC456.pdf',
        uploadDate: '2024-05-20',
        fileSize: '1.9 MB',
        uploadedBy: 'Technical Lead',
        status: 'processed',
        documentType: 'Datasheet'
      },
      {
        id: '3',
        fileName: 'Motor_Specifications_DEF789.pdf',
        uploadDate: '2024-05-19',
        fileSize: '2.7 MB',
        uploadedBy: 'Equipment Specialist',
        status: 'processing',
        documentType: 'Datasheet'
      }
    ]
    setHistory(mockHistory)
  }, [])

  const handleFileSelect = (file: File) => {
    setSelectedFile(file)
    if (file) {
      setActiveTab('upload')
      toast({
        title: "Datasheet Selected",
        description: `${file.name} is ready for processing`,
      })
    }
  }

  const handleDataExtracted = (data: Record<string, string>) => {
    // Enhanced data extraction for datasheets
    const enhancedData = {
      ...data,
      'Equipment Type': 'Centrifugal Pump',
      'Model Number': 'XYZ-123-456',
      'Manufacturer': 'Industrial Equipment Corp',
      'Flow Rate': '150 GPM',
      'Pressure Rating': '300 PSI',
      'Material': 'Stainless Steel 316',
      'Temperature Range': '-20°C to 180°C',
      'Power Requirements': '15 HP, 460V'
    }
    setExtractedData(enhancedData)
  }

  const handleSaveData = (data: Record<string, string>) => {
    // In a real app, this would save to the backend
    console.log('Saving datasheet data:', data)
    
    // Add to history
    if (selectedFile) {
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        fileName: selectedFile.name,
        uploadDate: new Date().toISOString().split('T')[0],
        fileSize: `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`,
        uploadedBy: 'Current User',
        status: 'processed',
        documentType: 'Datasheet'
      }
      setHistory(prev => [newHistoryItem, ...prev])
    }

    toast({
      title: "Datasheet Saved",
      description: "Technical specifications have been successfully saved",
    })
  }

  const handleViewHistoryItem = (item: HistoryItem) => {
    toast({
      title: "Loading Datasheet",
      description: `Opening ${item.fileName}`,
    })
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <Database className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Technical Datasheets</h1>
          <p className="text-muted-foreground">Upload and manage equipment datasheets with automated specification extraction</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload & Process
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
          />

          {selectedFile && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
              <DataExtraction
                data={extractedData}
                onSave={handleSaveData}
              />
              <PDFViewer
                file={selectedFile}
                onDataExtracted={handleDataExtracted}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          <UploadHistory
            history={history}
            onView={handleViewHistoryItem}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Datasheets
