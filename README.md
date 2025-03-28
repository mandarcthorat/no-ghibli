# No Ghibli Chrome Extension

A Chrome extension that helps you identify and filter out Studio Ghibli-related content from Twitter. This project consists of a Flask backend service that performs image classification and a Chrome extension that integrates with it.

## Project Structure

```
.
├── flask/                 # Backend Flask application
│   ├── app.py            # Main Flask application
│   ├── requirements.txt  # Python dependencies
│   ├── model.keras       # Trained Keras model
│   └── ghibli/          # Additional Ghibli-related files
└── extension/           # Chrome extension
    ├── manifest.json    # Extension configuration
    ├── popup.html      # Extension popup interface
    ├── popup.js        # Popup functionality
    ├── popup.css       # Popup styling
    ├── content.js      # Content script for webpage interaction
    └── images/         # Extension icons and images
```

## Features

- Real-time detection of Studio Ghibli-related images on Twitter
- Hides the entire tweet if it contains a Studio Ghibli-related image / video
- User-friendly popup interface for controlling the extension
- Efficient image classification using a trained Keras model

## Prerequisites

- Python 3.8 or higher
- Chrome browser
- Node.js and npm (for development)

## Installation

### Backend Setup

1. Navigate to the Flask directory:

   ```bash
   cd flask
   ```

2. Create a virtual environment (recommended):

   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the Flask server:
   ```bash
   python app.py
   ```

The backend server will start on `http://localhost:5000` by default.

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select the `extension` directory from this project
4. The extension icon should appear in your Chrome toolbar

## Usage

1. Click the extension icon in your Chrome toolbar to open the popup interface
2. Use the toggle switch to enable/disable Ghibli content detection
3. Browse Twitter as usual - the extension will automatically detect and handle Ghibli-related content

## Development

### Backend Development

The Flask backend uses:

- Flask for the web server
- TensorFlow/Keras for image classification
- Flask-CORS for handling cross-origin requests
- Gunicorn for production deployment

### Extension Development

The Chrome extension is built with:

- Vanilla JavaScript
- Chrome Extension APIs
- HTML/CSS for the popup interface

## API Endpoints

The Flask backend provides the following endpoints:

- `POST /predict`: Accepts image data and returns classification results
- `GET /health`: Health check endpoint

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
