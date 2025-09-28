# Parrot Language Coach - Lip Reading System

This project implements a lip reading system using MediaPipe for face landmark detection and Hugging Face models for speech recognition.

## Architecture

- **Frontend**: Next.js app with MediaPipe integration for real-time face landmark detection
- **Backend**: Python FastAPI service with Hugging Face model integration for lip reading
- **Model**: Uses `meetween/Llama-speechlmm-1.0-l` for multimodal speech recognition

## Setup Instructions

### Option 1: Docker Compose (Recommended)

1. **Clone and navigate to the project**:
   ```bash
   cd /Users/zainsyed/Documents/vthacks/parrotlanguagecoach
   ```

2. **Start the services**:
   ```bash
   docker-compose up --build
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

### Option 2: Manual Setup

#### Backend (Python Service)

1. **Navigate to the Python service**:
   ```bash
   cd compvis/services/lipread
   ```

2. **Create virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the service**:
   ```bash
   python app.py
   ```

#### Frontend (Next.js App)

1. **Navigate to the Next.js app**:
   ```bash
   cd nextapp
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set environment variable**:
   ```bash
   export LIPREAD_SERVICE_URL=http://localhost:8000
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

## Usage

1. **Open the application** in your browser (http://localhost:3000/lipread)
2. **Allow camera access** when prompted
3. **Click "Start Assessment"** to begin recording
4. **Speak the reference text**: "Hello world, this is a test."
5. **Click "Stop Assessment"** to process the lip reading

## Features

- **Real-time face landmark detection** using MediaPipe
- **Azure Speech-to-Text integration** for pronunciation assessment
- **Lip reading analysis** using Hugging Face models
- **Visual feedback** with lip landmark overlay
- **Detailed pronunciation scoring** with phoneme-level analysis

## Troubleshooting

### MediaPipe Issues
- Ensure you're using HTTPS or localhost
- Check browser console for script loading errors
- Verify camera permissions are granted

### Model Loading Issues
- The system includes fallback mechanisms if the Hugging Face model fails to load
- Check the Python service logs for model loading status
- Ensure sufficient GPU memory if using CUDA

### Camera Issues
- Grant camera permissions in your browser
- Use HTTPS or localhost for camera access
- Check that no other applications are using the camera

## API Endpoints

### Python Backend (Port 8000)
- `GET /health` - Health check
- `POST /predict` - Main lip reading prediction endpoint
- `POST /lipread` - Alternative endpoint for compatibility

### Next.js Frontend (Port 3000)
- `POST /api/lipread` - Proxy to Python backend
- `POST /api/azure-speech` - Azure Speech Service token generation

## Environment Variables

- `LIPREAD_SERVICE_URL` - URL of the Python backend service
- `AZURE_SPEECH_KEY` - Azure Speech Service API key
- `AZURE_SPEECH_REGION` - Azure Speech Service region
