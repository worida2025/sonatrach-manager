// API service for backend communication
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';


export interface Document {
  id: string;
  filename: string;
  upload_date: string;
  file_size: number;
  extracted_data: Record<string, string>;
  tag_extraction_result?: {
    status: string;
    message: string;
    tags: string[];
    new_acronyms: string[];
    file_key?: string;
    total_words_analyzed?: number;
  };
  status: 'processed' | 'processing' | 'failed';
}

export interface UploadResponse {
  status: string;
  message: string;
  extracted_data: Record<string, string>;
  tag_extraction_result?: {
    status: string;
    message: string;
    tags: string[];
    new_acronyms: string[];
    file_key?: string;
    total_words_analyzed?: number;
  };
  document_id: string;
}

class ApiService {
  private handleUnauthorized(): void {
    // Clear stored token
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    
    // Redirect to login page
    window.location.href = '/login';
  }

  private async handleResponse(response: Response): Promise<Response> {
    if (response.status === 401) {
      this.handleUnauthorized();
      throw new Error('Unauthorized');
    }
    return response;
  }

  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
      'Content-Type': 'application/json',
    };
  }

  private getAuthHeadersForFormData(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Authorization': token ? `Bearer ${token}` : '',
    };
  }
  async uploadPdf(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/upload/`, {
      method: 'POST',
      headers: this.getAuthHeadersForFormData(),
      body: formData,
    });

    await this.handleResponse(response);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }
  async getDocuments(): Promise<{ status: string; documents: Document[] }> {
    const response = await fetch(`${API_BASE_URL}/documents/`, {
      headers: this.getAuthHeaders(),
    });
    
    await this.handleResponse(response);
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    return response.json();
  }
  async getDocument(documentId: string): Promise<{ status: string; document: Document }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      headers: this.getAuthHeaders(),
    });
    
    await this.handleResponse(response);
    
    if (!response.ok) {
      throw new Error('Failed to fetch document');
    }

    return response.json();
  }
  async deleteDocument(documentId: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to delete document');
    }

    return response.json();
  }
  async downloadDocument(documentId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
      headers: this.getAuthHeadersForFormData(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to download document');
    }

    return response.blob();
  }
  async chatWithAllDocuments(message: string): Promise<{ response: string; extracted_fields?: Record<string, string> }> {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ message }),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }

    return response.json();
  }
  async chatWithDocument(documentId: string, message: string): Promise<{ response: string; extracted_fields?: Record<string, string> }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/chat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ document_id: documentId, message }),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }

    return response.json();
  }
  async getChatHistory(documentId: string): Promise<{ status: string; messages: any[] }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/chat-history`, {
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to fetch chat history');
    }

    return response.json();
  }
  async saveChatHistory(documentId: string, messages: any[]): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/save-chat`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ document_id: documentId, messages }),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to save chat history');
    }

    return response.json();
  }
  async getSettings(): Promise<{ model_name: string }> {
    const response = await fetch(`${API_BASE_URL}/admin/settings`, {
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to fetch settings');
    }

    return response.json();
  }
  async updateSettings(aiModelName: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/admin/settings`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ ai_model_name: aiModelName }),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to update settings');
    }

    return response.json();
  }  async updateDocumentData(documentId: string, extractedData: Record<string, string>): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/fields`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ extracted_data: extractedData }),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to update document data');
    }

    return response.json();
  }
  async updateDocumentFields(documentId: string, extractedData: Record<string, string>): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/fields`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ extracted_data: extractedData }),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to update document fields');
    }

    return response.json();
  }
  async deleteField(documentId: string, fieldName: string): Promise<{ status: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/fields/${encodeURIComponent(fieldName)}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to delete field');
    }

    return response.json();
  }
  async getTagStats(): Promise<{ status: string; stats: Record<string, number> }> {
    const response = await fetch(`${API_BASE_URL}/tags/stats`, {
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to get tag statistics');
    }

    return response.json();
  }

  async getDocumentTags(documentId: string): Promise<{ 
    status: string; 
    document_id: string; 
    filename: string; 
    tag_extraction_result: any; 
    detailed_tags: any[] 
  }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/tags`, {
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to get document tags');
    }

    return response.json();
  }

  async reprocessDocumentTags(documentId: string): Promise<{ 
    status: string; 
    message: string; 
    tag_extraction_result: any 
  }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/reprocess-tags`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse(response);

    if (!response.ok) {
      throw new Error('Failed to reprocess document tags');
    }

    return response.json();
  }
}

export const apiService = new ApiService();
