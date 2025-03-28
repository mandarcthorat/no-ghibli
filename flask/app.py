import os
import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from io import BytesIO
from PIL import Image
import numpy as np
import tensorflow as tf
import io

# Configure logging
log_dir = os.environ.get("LOG_DIR", "logs")
os.makedirs(log_dir, exist_ok=True)
log_level = os.environ.get("LOG_LEVEL", "INFO")


app = Flask(__name__)
CORS(app)

# Load your model
# Replace this with your actual model loading code
model = None


def setup_logging():
    """Set up logging for the application"""
    numeric_level = getattr(logging, log_level.upper(), None)
    if not isinstance(numeric_level, int):
        numeric_level = logging.INFO

    formatter = logging.Formatter(
        "[%(asctime)s] %(levelname)s in %(module)s: %(message)s"
    )

    # File handler - rotates log files
    file_handler = RotatingFileHandler(
        os.path.join(log_dir, "app.log"), maxBytes=10485760, backupCount=10  # 10MB
    )
    file_handler.setFormatter(formatter)
    file_handler.setLevel(numeric_level)

    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    console_handler.setLevel(numeric_level)

    # Add handlers to app logger
    app.logger.addHandler(file_handler)
    app.logger.addHandler(console_handler)
    app.logger.setLevel(numeric_level)

    # Also configure the werkzeug logger
    logging.getLogger("werkzeug").setLevel(numeric_level)
    logging.getLogger("werkzeug").addHandler(file_handler)


def load_model():
    global model
    # Replace this with your actual model path
    model = tf.keras.models.load_model("model.keras")
    pass


def load_and_preprocess_image(img):
    """Preprocess image for model prediction"""
    try:
        # Resize the image
        img = img.resize((224, 224))
        # Convert to RGB if necessary
        if img.mode != "RGB":
            img = img.convert("RGB")
        # Convert to numpy array
        img_array = np.array(img)
        # Normalize pixel values
        img_array = img_array / 255.0
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        app.logger.error(f"Error processing image: {str(e)}")
        return None


@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint for monitoring and load balancing"""
    if model is None:
        return jsonify({"status": "error", "message": "Model not loaded"}), 503
    return jsonify({"status": "healthy", "message": "Service is running"}), 200


@app.route("/predict", methods=["POST"])
def predict():
    """Endpoint to make predictions on images"""
    try:
        # Check if content type is JSON
        if not request.is_json:
            app.logger.warning("Request content type is not JSON")
            return jsonify({"error": "Content type must be application/json"}), 400

        data = request.json
        image_url = data.get("image_url")

        if not image_url:
            app.logger.warning("No image URL provided in request")
            return jsonify({"error": "No image URL provided"}), 400

        # Download the image with timeout
        try:
            response = requests.get(image_url, timeout=10)
            response.raise_for_status()  # Raise exception for 4xx/5xx responses
        except requests.exceptions.RequestException as e:
            app.logger.error(f"Failed to download image from URL: {str(e)}")
            return jsonify({"error": f"Failed to download image: {str(e)}"}), 400

        # Open and process the image
        try:
            img = Image.open(BytesIO(response.content))
        except Exception as e:
            app.logger.error(f"Failed to process image: {str(e)}")
            return jsonify({"error": f"Invalid image format: {str(e)}"}), 400

        # Process image and make prediction
        processed_image = load_and_preprocess_image(img)
        if processed_image is None:
            return jsonify({"error": "Failed to process image"}), 400

        if model is None:
            app.logger.error("Model not loaded")
            return jsonify({"error": "Model not available"}), 503

        # Make prediction
        prediction = model.predict(processed_image)
        predicted_class = "Ghibli" if prediction[0][0] > 0.5 else "Not Ghibli"

        app.logger.info(f"Prediction made: {predicted_class}")

        return jsonify(
            {
                "predicted_class": predicted_class,
                "confidence": float(
                    abs(0.5 - prediction[0][0]) * 2
                ),  # Scale to 0-1 confidence
                "raw_prediction": float(prediction[0][0]),
            }
        )

    except Exception as e:
        app.logger.error(f"Prediction error: {str(e)}")
        return jsonify({"error": "Internal server error", "details": str(e)}), 500


if __name__ == "__main__":
    setup_logging()
    load_model()
    app.logger.info("Application initialized successfully")
    app.run()
