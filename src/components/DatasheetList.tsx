import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  Search, 
  FileText, 
  Calendar, 
  Database,
  Filter,
  Eye,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface DatasheetInfo {
  id: string
  equipment_name: string
  pages: string
  created_at: string
  fields_count: number
}

interface DatasheetListProps {
  onViewDatasheet: (datasheetId: string) => void
}

const DatasheetList: React.FC<DatasheetListProps> = ({ onViewDatasheet }) => {
  const [datasheets, setDatasheets] = useState<DatasheetInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filteredDatasheets, setFilteredDatasheets] = useState<DatasheetInfo[]>([])

  useEffect(() => {
    loadDatasheets()
  }, [])

  useEffect(() => {
    // Filter datasheets based on search term
    const filtered = datasheets.filter(datasheet =>
      datasheet.equipment_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      datasheet.id.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredDatasheets(filtered)
  }, [datasheets, searchTerm])
  const loadDatasheets = async () => {
    try {
      setLoading(true)
      const response = await fetch('http://localhost:8001/datasheets/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load datasheets')
      }

      const data = await response.json()
      setDatasheets(data)
    } catch (error) {
      console.error('Error loading datasheets:', error)
      toast({
        title: "Error",
        description: "Failed to load datasheets",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }
  const deleteDatasheet = async (datasheetId: string) => {
    try {
      const response = await fetch(`http://localhost:8001/datasheets/${datasheetId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to delete datasheet')
      }

      toast({
        title: "Success",
        description: "Datasheet deleted successfully"
      })

      // Reload datasheets
      loadDatasheets()
    } catch (error) {
      console.error('Error deleting datasheet:', error)
      toast({
        title: "Error",
        description: "Failed to delete datasheet",
        variant: "destructive"
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading datasheets...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Processed Datasheets</h2>
          <p className="text-muted-foreground">
            {datasheets.length} datasheet{datasheets.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <Button onClick={loadDatasheets} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search datasheets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Datasheets Grid */}
      {filteredDatasheets.length === 0 ? (
        <div className="text-center py-12">
          <Database className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">
            {searchTerm ? 'No matching datasheets' : 'No datasheets found'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm 
              ? 'Try adjusting your search terms'
              : 'Upload and process a document to see datasheets here'
            }
          </p>
          {searchTerm && (
            <Button variant="outline" onClick={() => setSearchTerm('')}>
              Clear Search
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDatasheets.map((datasheet) => (
            <Card key={datasheet.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg line-clamp-2">
                      {datasheet.equipment_name}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(datasheet.created_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {datasheet.pages}
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Fields extracted:</span>
                  <Badge variant="outline">
                    {datasheet.fields_count}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => onViewDatasheet(datasheet.id)}
                    size="sm"
                    className="flex-1"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View & Chat
                  </Button>
                  
                  <Button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this datasheet?')) {
                        deleteDatasheet(datasheet.id)
                      }
                    }}
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="text-xs text-muted-foreground border-t pt-2">
                  ID: {datasheet.id}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default DatasheetList
