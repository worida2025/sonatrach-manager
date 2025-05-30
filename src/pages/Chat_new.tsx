import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageCircle, Send, FileText, Bot } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { apiService, Document } from '@/lib/api'

interface Message {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: string
  extracted_fields?: Record<string, string>
}

interface ChatSession {
  documentId: string
  documentName: string
  messages: Message[]
}

const Chat = () => {
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null)
  const [newMessage, setNewMessage] = useState('')
  const [chatSessions, setChatSessions] = useState<Record<string, ChatSession>>({})
  const { user } = useAuth()
  
  const queryClient = useQueryClient()

  // Fetch available documents
  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiService.getDocuments(),
  })

  const documents = documentsData?.documents || []
  const currentSession = selectedDocumentId ? chatSessions[selectedDocumentId] : null

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ documentId, message }: { documentId: string, message: string }) => {
      return apiService.chatWithDocument(documentId, message)
    },
    onSuccess: (response, variables) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: variables.message,
        sender: 'user',
        timestamp: new Date().toISOString()
      }

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.response,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        extracted_fields: response.extracted_fields
      }

      setChatSessions(prev => {
        const session = prev[variables.documentId] || {
          documentId: variables.documentId,
          documentName: documents.find(d => d.id === variables.documentId)?.filename || 'Unknown Document',
          messages: []
        }

        return {
          ...prev,
          [variables.documentId]: {
            ...session,
            messages: [...session.messages, userMessage, aiMessage]
          }
        }
      })

      setNewMessage('')
    },
    onError: (error) => {
      console.error('Failed to send message:', error)
    }
  })

  const handleSendMessage = () => {
    if (!selectedDocumentId || !newMessage.trim()) return
    
    sendMessageMutation.mutate({
      documentId: selectedDocumentId,
      message: newMessage.trim()
    })
  }

  const handleDocumentSelect = (documentId: string) => {
    setSelectedDocumentId(documentId)
    
    // Initialize chat session if it doesn't exist
    if (!chatSessions[documentId]) {
      const document = documents.find(d => d.id === documentId)
      setChatSessions(prev => ({
        ...prev,
        [documentId]: {
          documentId,
          documentName: document?.filename || 'Unknown Document',
          messages: [{
            id: 'welcome',
            content: `Hello! I'm here to help you analyze "${document?.filename}". You can ask me questions about the document's content, request specific information, or have me extract data fields.`,
            sender: 'assistant',
            timestamp: new Date().toISOString()
          }]
        }
      }))
    }
  }

  if (documentsLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Bot className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Loading documents...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-gray-50">
      {/* Document Selection Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Document Chat</h2>
          <p className="text-sm text-gray-600 mb-4">
            Select a document to start chatting with AI about its contents.
          </p>
          
          <Select value={selectedDocumentId || ''} onValueChange={handleDocumentSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Select a document" />
            </SelectTrigger>
            <SelectContent>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    <span className="truncate">{doc.filename}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chat Sessions List */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Recent Conversations</h3>
          {Object.values(chatSessions).map((session) => (
            <div
              key={session.documentId}
              className={`p-2 rounded cursor-pointer transition-colors ${
                selectedDocumentId === session.documentId
                  ? 'bg-blue-50 border border-blue-200'
                  : 'hover:bg-gray-50'
              }`}
              onClick={() => setSelectedDocumentId(session.documentId)}
            >
              <p className="text-sm font-medium truncate">{session.documentName}</p>
              <p className="text-xs text-gray-500">
                {session.messages.length} messages
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {currentSession ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-gray-600" />
                <div>
                  <h3 className="font-medium">{currentSession.documentName}</h3>
                  <p className="text-sm text-gray-500">
                    AI-powered document analysis and extraction
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4 max-w-4xl mx-auto">
                {currentSession.messages.map((message) => (
                  <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-lg p-3 ${
                      message.sender === 'user' 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-white border border-gray-200'
                    }`}>
                      <p className="text-sm">{message.content}</p>
                      
                      {/* Show extracted fields if available */}
                      {message.extracted_fields && Object.keys(message.extracted_fields).length > 0 && (
                        <div className="mt-3 p-2 bg-gray-50 rounded border">
                          <p className="text-xs font-medium text-gray-700 mb-2">Extracted Data:</p>
                          <div className="space-y-1">
                            {Object.entries(message.extracted_fields).map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="font-medium">{key}:</span> {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <p className="text-xs mt-2 opacity-70">
                        {format(new Date(message.timestamp), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                ))}
                
                {sendMessageMutation.isPending && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 animate-spin" />
                        <span className="text-sm">AI is thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {/* Message Input */}
            <div className="bg-white border-t border-gray-200 p-4">
              <form 
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSendMessage()
                }} 
                className="flex gap-2"
              >
                <Input
                  placeholder="Ask about the document content, request data extraction..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                  disabled={sendMessageMutation.isPending}
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Document to Chat</h3>
              <p className="text-gray-500 max-w-md">
                Choose a document from the sidebar to start an AI-powered conversation. 
                You can ask questions, request data extraction, or analyze the content.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Chat
