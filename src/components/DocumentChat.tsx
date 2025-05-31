import React, { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, Send, Bot, Database, User } from 'lucide-react'
import { format } from 'date-fns'
import { apiService } from '@/lib/api'
import { toast } from '@/hooks/use-toast'

interface Message {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: string
  extracted_fields?: Record<string, string>
}

interface DocumentChatProps {
  documentId: string
  onFieldsExtracted: (fields: Record<string, string>) => void
}

export function DocumentChat({ documentId, onFieldsExtracted }: DocumentChatProps) {
  const [newMessage, setNewMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)

  // Load chat history when component mounts or documentId changes
  useEffect(() => {
    loadChatHistory()
  }, [documentId])

  const loadChatHistory = async () => {
    try {
      setIsLoadingHistory(true)
      const response = await apiService.getChatHistory(documentId)
      
      if (response.messages && response.messages.length > 0) {
        setMessages(response.messages)
      } else {
        // Set default welcome message if no history exists
        setMessages([{
          id: 'welcome',
          content: `Hello! I can help you extract specific fields from this document. Just ask me to extract ONE field at a time, for example:

• "Extract the operating temperature"
• "Find the pressure rating"  
• "Get the equipment ID number"
• "Extract the pump model"

Please specify ONE field per message. What field would you like me to extract?`,
          sender: 'assistant',
          timestamp: new Date().toISOString()
        }])
      }
    } catch (error) {
      console.error('Error loading chat history:', error)
      // Set default welcome message on error
      setMessages([{
        id: 'welcome',
        content: `Hello! I can help you extract specific fields from this document. Just ask me to extract ONE field at a time, for example:

• "Extract the operating temperature"
• "Find the pressure rating"  
• "Get the equipment ID number"
• "Extract the pump model"

Please specify ONE field per message. What field would you like me to extract?`,
        sender: 'assistant',
        timestamp: new Date().toISOString()
      }])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const saveChatHistory = async (updatedMessages: Message[]) => {
    try {
      await apiService.saveChatHistory(documentId, updatedMessages)
    } catch (error) {
      console.error('Error saving chat history:', error)
    }
  }

  // Send message mutation for document-specific chat
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiService.chatWithDocument(documentId, message)
    },
    onSuccess: (response, messageText) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: messageText,
        sender: 'user',
        timestamp: new Date().toISOString()      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: response.response,
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        extracted_fields: response.extracted_fields      }

      const updatedMessages = [...messages, userMessage, assistantMessage]
      setMessages(updatedMessages)

      // Save chat history
      saveChatHistory(updatedMessages)// If fields were extracted, pass them to parent component
      if (response.extracted_fields && Object.keys(response.extracted_fields).length > 0) {
        // Only take the first field to ensure single field extraction
        const fieldEntries = Object.entries(response.extracted_fields)
        const singleField = fieldEntries.length > 0 ? { [fieldEntries[0][0]]: fieldEntries[0][1] } : {}
        
        onFieldsExtracted(singleField)
        toast({
          title: "Field Extracted",
          description: `Field "${fieldEntries[0][0]}" extracted and added to the document data`,
        })
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Chat Error",
        description: error.message,
        variant: "destructive",
      })
    }
  })

  const handleSendMessage = () => {
    if (!newMessage.trim()) return

    sendMessageMutation.mutate(newMessage)
    setNewMessage('')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0 flex flex-row items-center gap-2 pb-3">
        <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
        <CardTitle className="text-base sm:text-lg">
          <span className="hidden sm:inline">Extract Fields</span>
          <span className="sm:hidden">Extract</span>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-4 p-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center flex-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              <span className="text-xs sm:text-sm">Loading chat history...</span>
            </div>
          </div>
        ) : (
          <>            <ScrollArea className="flex-1 pr-2 custom-scrollbar">
              <div className="space-y-3 sm:space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-2 sm:gap-3 ${
                      message.sender === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.sender === 'assistant' && (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                      </div>
                    )}
                    
                    <div className={`max-w-[85%] sm:max-w-[80%] space-y-2 ${
                      message.sender === 'user' ? 'items-end' : 'items-start'
                    }`}>
                      <div
                        className={`rounded-lg px-2 py-1 sm:px-3 sm:py-2 text-xs sm:text-sm ${
                          message.sender === 'user'
                            ? 'bg-primary text-primary-foreground ml-auto'
                            : 'bg-muted'
                        }`}
                      >
                        <div className="whitespace-pre-wrap break-words">{message.content}</div>
                      </div>
                      
                      {message.extracted_fields && Object.keys(message.extracted_fields).length > 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2 sm:p-3 space-y-2">
                          <div className="flex items-center gap-2 text-green-700 font-medium text-xs sm:text-sm">
                            <Database className="h-3 w-3 sm:h-4 sm:w-4" />
                            Extracted Fields:
                          </div>
                          <div className="space-y-1">
                            {Object.entries(message.extracted_fields).map(([key, value]) => (
                              <div key={key} className="text-xs sm:text-sm break-words">
                                <span className="font-medium text-green-800">{key}:</span>{' '}
                                <span className="text-green-700">{value}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(message.timestamp), 'HH:mm')}
                      </div>
                    </div>

                    {message.sender === 'user' && (
                      <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex-shrink-0 flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Extract ONE specific field..."
                disabled={sendMessageMutation.isPending}
                className="flex-1 text-xs sm:text-sm"
                size="sm"
              />
              <Button
                onClick={handleSendMessage}
                disabled={sendMessageMutation.isPending || !newMessage.trim()}
                size="sm"
                className="h-8 w-8 p-0 sm:h-9 sm:w-9"
              >
                {sendMessageMutation.isPending ? (
                  <div className="w-3 h-3 sm:w-4 sm:h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
