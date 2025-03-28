from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from io import BytesIO
from PIL import Image
import numpy as np
import tensorflow as tf
import io

app = Flask(__name__)
CORS(app)

# Load your model
# Replace this with your actual model loading code
model = None


def load_model():
    global model
    # Replace this with your actual model path
    model = tf.keras.models.load_model("model.keras")
    pass


def load_and_preprocess_image(img):
    try:
        # Resize the image
        img = img.resize((224, 224))
        # Convert to RGB if necessary
        if img.mode != "RGB":
            img = img.convert("RGB")
        # Convert to numpy array
        img_array = np.array(img)
        # Add batch dimension
        img_array = np.expand_dims(img_array, axis=0)
        return img_array
    except Exception as e:
        print(f"Error processing image: {str(e)}")
        return None


@app.route("/predict", methods=["POST"])
def predict():
    try:
        data = request.json
        image_url = data.get("image_url")

        if not image_url:
            return jsonify({"error": "No image URL provided"}), 400

        # Download the image
        response = requests.get(image_url)
        img = Image.open(BytesIO(response.content))

        # Here you would process the image and run it through your model
        # For now, we'll return a mock response
        # Replace this with actual model prediction
        prediction = model.predict(load_and_preprocess_image(img))
        predicted_class = "Ghibli" if prediction < 0.5 else "No Ghibli"

        return jsonify(
            {
                "predicted_class": predicted_class,
                "predictions": [[float(prediction)]],
            }
        )

    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    load_model()  # Load the model before starting the server
    app.run(debug=True, host="0.0.0.0", port=10000)
