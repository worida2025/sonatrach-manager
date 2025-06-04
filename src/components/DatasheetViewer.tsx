import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  MessageSquare, 
  FileText, 
  Settings, 
  Send, 
  Bot, 
  User,
  Clock,
  Database,
  ChevronRight,
  AlertCircle
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { format } from 'date-fns'

interface DatasheetField {
  [key: string]: string
}

interface ChatMessage {
  id: string
  message: string
  response: string
  timestamp: string
}

interface DatasheetData {
  id: string
  equipment_name: string
  document_id: string
  created_at: string
  content: {
    text: string
    tables: Array<{
      page: number
      data: string[][]
    }>
  }
  parsed_fields: DatasheetField
  chat_history: ChatMessage[]
}

interface DatasheetViewerProps {
  datasheetId: string
  onClose: () => void
}

const DatasheetViewer: React.FC<DatasheetViewerProps> = ({ datasheetId, onClose }) => {
  const [datasheet, setDatasheet] = useState<DatasheetData | null>(null)
  const [loading, setLoading] = useState(true)
  const [chatMessage, setChatMessage] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    loadDatasheet()
  }, [datasheetId])

  const loadDatasheet = async () => {    try {
      setLoading(true)
      const response = await fetch(`http://localhost:8001/datasheets/${datasheetId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to load datasheet')
      }

      const data = await response.json()
      setDatasheet(data.datasheet)
    } catch (error) {
      console.error('Error loading datasheet:', error)
      toast({
        title: "Error",
        description: "Failed to load datasheet",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const sendChatMessage = async () => {
    if (!chatMessage.trim() || chatLoading) return

    try {
      setChatLoading(true)
      const response = await fetch(`http://localhost:8001/datasheets/${datasheetId}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          datasheet_id: datasheetId,
          message: chatMessage
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      
      // Reload datasheet to get updated chat history
      await loadDatasheet()
      setChatMessage('')
      
      toast({
        title: "Message sent",
        description: "AI response received"
      })
    } catch (error) {
      console.error('Error sending message:', error)
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      })
    } finally {
      setChatLoading(false)
    }
  }

  const renderFieldsTable = () => {
    if (!datasheet?.parsed_fields) return null

    const fields = Object.entries(datasheet.parsed_fields)
    
    if (fields.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-12 w-12 mx-auto mb-4" />
          <p>No technical fields automatically extracted</p>
          <p className="text-sm">Use the chat feature to ask about specific information</p>
        </div>
      )
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Extracted Technical Fields</h3>
        <div className="grid gap-4">
          {fields.map(([key, value]) => (
            <Card key={key} className="p-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <Badge variant="secondary" className="text-xs">
                    {key}
                  </Badge>
                  <p className="text-sm font-medium">{value}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const renderTables = () => {
    if (!datasheet?.content?.tables || datasheet.content.tables.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Database className="h-12 w-12 mx-auto mb-4" />
          <p>No tables detected in this datasheet</p>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <h3 className="text-lg font-semibold">Extracted Tables</h3>
        {datasheet.content.tables.map((table, index) => (
          <Card key={index} className="p-4">
            <div className="mb-4">
              <Badge variant="outline">Page {table.page}</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <tbody>
                  {table.data.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b">
                      {row.map((cell, cellIndex) => (
                        <td 
                          key={cellIndex} 
                          className="border p-2 text-sm"
                        >
                          {cell || '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  const renderChatHistory = () => {
    if (!datasheet?.chat_history || datasheet.chat_history.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-4" />
          <p>No chat history yet</p>
          <p className="text-sm">Start a conversation about this datasheet</p>
        </div>
      )
    }

    return (
      <ScrollArea className="h-[400px] w-full">
        <div className="space-y-4 p-4">
          {datasheet.chat_history.map((chat, index) => (
            <div key={index} className="space-y-4">
              {/* User message */}
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-muted rounded-lg p-3">
                    <p className="text-sm">{chat.message}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(chat.timestamp), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>

              {/* AI response */}
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    <Bot className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="bg-primary/10 rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{chat.response}</p>
                  </div>
                </div>
              </div>
              
              {index < datasheet.chat_history.length - 1 && (
                <Separator className="my-4" />
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading datasheet...</p>
        </div>
      </div>
    )
  }

  if (!datasheet) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <p>Datasheet not found</p>
        <Button onClick={onClose} className="mt-4">Go Back</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{datasheet.equipment_name}</h1>
          <p className="text-muted-foreground">
            Created {format(new Date(datasheet.created_at), 'MMM d, yyyy')}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>

      {/* Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="tables">Tables</TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Datasheet Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Equipment Name</label>
                  <p className="font-medium">{datasheet.equipment_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Document ID</label>
                  <p className="font-medium">{datasheet.document_id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Fields Extracted</label>
                  <p className="font-medium">{Object.keys(datasheet.parsed_fields).length}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Chat Messages</label>
                  <p className="font-medium">{datasheet.chat_history.length}</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <label className="text-sm font-medium text-muted-foreground">Raw Content (Preview)</label>
                <ScrollArea className="h-32 w-full border rounded-md p-3 mt-2">
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {datasheet.content.text.substring(0, 500)}...
                  </p>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              {renderFieldsTable()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tables" className="space-y-6">
          <Card>
            <CardContent className="p-6">
              {renderTables()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat with Datasheet
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {renderChatHistory()}
              
              <div className="flex gap-2">
                <Input
                  placeholder="Ask about this datasheet..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  disabled={chatLoading}
                />
                <Button 
                  onClick={sendChatMessage}
                  disabled={chatLoading || !chatMessage.trim()}
                >
                  {chatLoading ? (
                    <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default DatasheetViewer
