
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Save, Edit2, Check, X } from 'lucide-react'
import { useState } from 'react'

interface DataExtractionProps {
  data: Record<string, string>
  onSave: (data: Record<string, string>) => void
  readOnly?: boolean
}

export function DataExtraction({ data, onSave, readOnly = false }: DataExtractionProps) {
  const [editingData, setEditingData] = useState<Record<string, string>>(data)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

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

  const handleSaveAll = () => {
    onSave(editingData)
    setHasChanges(false)
  }

  return (    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">
          {readOnly ? 'Document Data' : 'Extracted Data'}
        </CardTitle>
        {!readOnly && (
          <Button 
            onClick={handleSaveAll}
            disabled={!hasChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            Save Changes
          </Button>
        )}
      </CardHeader>      <CardContent className="space-y-4">
        {Object.entries(editingData).map(([key, value]) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={key} className="text-sm font-medium">
              {key}
            </Label>
            {!readOnly && editingField === key ? (
              <div className="flex gap-2">
                <Input
                  id={key}
                  value={value}
                  onChange={(e) => setEditingData(prev => ({ ...prev, [key]: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSave(key, editingData[key])}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCancel}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id={key}
                  value={value}
                  readOnly
                  className="flex-1 bg-muted"
                />
                {!readOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(key)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
