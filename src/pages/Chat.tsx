import React, { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageCircle, Send, Bot, Database } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '@/contexts/AuthContext'
import { apiService } from '@/lib/api'

interface Message {
  id: string
  content: string
  sender: 'user' | 'assistant'
  timestamp: string
  extracted_fields?: Record<string, string>
}

const Chat = () => {
  const [newMessage, setNewMessage] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      content: `Hello! I'm your AI assistant for analyzing document data. I have access to all extracted data from your uploaded documents. You can ask me about:

• Specific field values across documents
• Comparisons between different documents  
• Summaries of equipment or technical data
• General questions about the document contents

What would you like to know?`,
      sender: 'assistant',
      timestamp: new Date().toISOString()
    }
  ])
  const { user } = useAuth()

  // Send message mutation using general chat
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return apiService.chatWithAllDocuments(message)
    },
    onSuccess: (response, messageText) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        content: messageText,
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

      setMessages(prev => [...prev, userMessage, aiMessage])
      setNewMessage('')
    },
    onError: (error) => {
      console.error('Failed to send message:', error)
      // Add error message to chat
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        sender: 'assistant',
        timestamp: new Date().toISOString()
      }
      setMessages(prev => [...prev, errorMessage])
    }
  })

  const handleSendMessage = () => {
    if (!newMessage.trim()) return
    
    sendMessageMutation.mutate(newMessage.trim())
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-gray-50">
      {/* Documents Overview Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Database className="h-5 w-5" />
            Document Database Chat
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            Chat with AI about all your uploaded documents and their extracted data.
          </p>
        </div>

        {/* Sample Questions */}
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Sample Questions</h3>
          <div className="space-y-2">
            {[
              "What equipment is listed in all documents?",
              "Show me all pressure ratings",
              "Compare temperature data across documents",
              "What are the document titles?",
              "List all notes and general notes"
            ].map((question, index) => (
              <button
                key={index}
                onClick={() => setNewMessage(question)}
                className="w-full text-left text-xs p-2 bg-blue-50 hover:bg-blue-100 rounded border text-blue-700 transition-colors"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-gray-600" />
            <div>
              <h3 className="font-medium">AI Document Analysis Assistant</h3>
              <p className="text-sm text-gray-500">
                Ask questions about your documents' extracted data
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-lg p-3 ${
                  message.sender === 'user' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white border border-gray-200'
                }`}>
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Show extracted fields if available */}
                  {message.extracted_fields && Object.keys(message.extracted_fields).length > 0 && (
                    <div className="mt-3 p-2 bg-gray-50 rounded border">
                      <p className="text-xs font-medium text-gray-700 mb-2">Relevant Data Found:</p>
                      <div className="space-y-1">
                        {Object.entries(message.extracted_fields).map(([document, data]) => (
                          <div key={document} className="text-xs">
                            <span className="font-medium text-blue-600">{document}:</span>
                            {typeof data === 'object' ? (
                              <div className="ml-2 mt-1">
                                {Object.entries(data as Record<string, string>).map(([key, value]) => (
                                  <div key={key}>
                                    <span className="font-medium">{key}:</span> {value}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span> {data}</span>
                            )}
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
                    <span className="text-sm">AI is analyzing your documents...</span>
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
              placeholder="Ask about your documents data - equipment, temperatures, pressures, notes, etc..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
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
      </div>
    </div>
  )
}

export default Chat
