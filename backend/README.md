# PDF Data Extraction Backend

A FastAPI backend for processing PDF files and extracting data from Process & Instrumentation Diagrams (PIDs).

## Features

- PDF file upload and processing
- Text and table extraction from PDFs
- PID-specific data analysis
- Document management (CRUD operations)
- RESTful API endpoints
- CORS support for frontend integration

## Setup

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Run the server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

## API Documentation

Once the server is running, visit `http://localhost:8000/docs` for interactive API documentation.

## Endpoints

- `POST /upload/` - Upload and process a PDF file
- `GET /documents/` - Get list of all uploaded documents
- `GET /documents/{document_id}` - Get specific document by ID
- `DELETE /documents/{document_id}` - Delete a document

## Environment

The backend runs on port 8000 by default and accepts requests from:
- http://localhost:8080 (Vite dev server)
- http://localhost:3000 (Alternative frontend port)
