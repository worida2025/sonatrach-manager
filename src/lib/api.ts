// API service for backend communication
const API_BASE_URL = 'http://localhost:8000';

export interface Document {
  id: string;
  filename: string;
  upload_date: string;
  file_size: number;
  extracted_data: Record<string, string>;
  status: 'processed' | 'processing' | 'failed';
}

export interface UploadResponse {
  status: string;
  message: string;
  extracted_data: Record<string, string>;
  document_id: string;
}

class ApiService {
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
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    return response.json();
  }

  async getDocument(documentId: string): Promise<{ status: string; document: Document }> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
      headers: this.getAuthHeaders(),
    });
    
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

    if (!response.ok) {
      throw new Error('Failed to delete document');
    }

    return response.json();
  }

  async downloadDocument(documentId: string): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
      headers: this.getAuthHeadersForFormData(),
    });

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

    if (!response.ok) {
      throw new Error('Failed to send chat message');
    }

    return response.json();
  }
}

export const apiService = new ApiService();
