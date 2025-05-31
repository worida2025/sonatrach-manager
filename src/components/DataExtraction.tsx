
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Save, Edit2, Check, X, Trash2, Database } from 'lucide-react'
import { useState, useEffect } from 'react'

interface DataExtractionProps {
  data: Record<string, string>
  onSave: (data: Record<string, string>) => void
  onFieldDelete?: (fieldKey: string) => void
  readOnly?: boolean
}

export function DataExtraction({ data, onSave, onFieldDelete, readOnly = false }: DataExtractionProps) {
  const [editingData, setEditingData] = useState<Record<string, string>>(data)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Update editing data when props change
  useEffect(() => {
    setEditingData(data)
  }, [data])

  const handleEdit = (key: string) => {
    setEditingField(key)
  }

  const handleSave = (key: string, value: string) => {
    setEditingData(prev => ({ ...prev, [key]: value }))
    setEditingField(null)
    setHasChanges(true)
  }

  const handleCancel = () => {
    setEditingField(null)
    setEditingData(data)
  }
  const handleDeleteField = (key: string) => {
    if (onFieldDelete) {
      onFieldDelete(key)
      setHasChanges(true)
    }
  }

  const handleSaveAll = () => {
    onSave(editingData)
    setHasChanges(false)
  }
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between pb-3 space-y-2 sm:space-y-0">
        <CardTitle className="text-base sm:text-lg flex items-center gap-2">
          <Database className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="hidden sm:inline">
            {readOnly ? 'Document Data' : 'Extracted Data'}
          </span>
          <span className="sm:hidden">
            {readOnly ? 'Data' : 'Extracted'}
          </span>
        </CardTitle>
        {!readOnly && (
          <Button 
            onClick={handleSaveAll}
            disabled={!hasChanges}
            className="gap-2 self-start sm:self-auto"
            size="sm"
          >
            <Save className="h-4 w-4" />
            <span className="hidden sm:inline">Save Changes</span>
            <span className="sm:hidden">Save</span>
          </Button>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden p-4">
        {Object.keys(editingData).length === 0 ? (
          <div className="flex items-center justify-center h-full text-center text-muted-foreground">
            <div>
              <Database className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-4 opacity-50" />
              <p className="text-sm sm:text-base font-medium mb-2">No Data Extracted</p>
              <p className="text-xs sm:text-sm">
                {readOnly 
                  ? 'No fields have been extracted from this document yet.'
                  : 'Upload a document or use the chat to extract data fields.'
                }
              </p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-full pr-2 custom-scrollbar">
            <div className="space-y-4">
              {Object.entries(editingData).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <Label htmlFor={key} className="text-xs sm:text-sm font-medium">
                    {key}
                  </Label>
                  {!readOnly && editingField === key ? (
                    <div className="flex gap-2">
                      <Input
                        id={key}
                        value={value}
                        onChange={(e) => setEditingData(prev => ({ ...prev, [key]: e.target.value }))}
                        className="flex-1 text-xs sm:text-sm"
                        size="sm"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSave(key, editingData[key])}
                        className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                      >
                        <Check className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCancel}
                        className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                      >
                        <X className="h-3 w-3 sm:h-4 sm:w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        id={key}
                        value={value}
                        readOnly
                        className="flex-1 bg-muted text-xs sm:text-sm"
                        size="sm"
                      />
                      {!readOnly && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(key)}
                            className="h-8 w-8 p-0 sm:h-9 sm:w-9"
                          >
                            <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" />
                          </Button>
                          {onFieldDelete && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteField(key)}
                              className="text-destructive hover:text-destructive h-8 w-8 p-0 sm:h-9 sm:w-9"
                            >
                              <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
