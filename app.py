from flask import Flask, request, jsonify, send_from_directory
from azure.ai.textanalytics import TextAnalyticsClient
from azure.core.credentials import AzureKeyCredential
from azure.cosmos import CosmosClient, PartitionKey
from datetime import datetime
import os

app = Flask(__name__)

# -----------------------------
# Azure Language Service Config (HARD-CODED)
# -----------------------------
TEXT_ANALYTICS_KEY = "167bc78bf8dd431a808011ad307c291b"
TEXT_ANALYTICS_ENDPOINT = "https://eastus.api.cognitive.microsoft.com/"

client = TextAnalyticsClient(endpoint=TEXT_ANALYTICS_ENDPOINT, credential=AzureKeyCredential(TEXT_ANALYTICS_KEY))

# -----------------------------
# Cosmos DB Config (HARD-CODED)
# -----------------------------
COSMOS_KEY = "XpRqcSAwwZ3Mhvh6kwvHT6uBkbnVgYHqsXayKihvc1tJdn8f3y1Zn8JZJpJ3357b6oR5Qw13fAyVACDbFdTOdw=="
COSMOS_ENDPOINT = "https://cosmos1890114.documents.azure.com:443/"

cosmos_client = CosmosClient(COSMOS_ENDPOINT, COSMOS_KEY)
database = cosmos_client.create_database_if_not_exists(id="SentimentDB")
container = database.create_container_if_not_exists(
    id="AnalysisResults",
    partition_key=PartitionKey(path="/id"),
)

# -----------------------------
# Serve index.html
# -----------------------------
@app.route("/")
def index():
    return send_from_directory(os.getcwd(), "index.html")

# -----------------------------
# Analyze text
# -----------------------------
@app.route("/analyze", methods=["POST"])
def analyze():
    text = request.json.get("text", "")
    if not text:
        return jsonify({"error": "No text provided"}), 400

    # Sentiment analysis
    sentiment_result = client.analyze_sentiment([text])[0]

    # Key phrases
    key_phrases_result = client.extract_key_phrases([text])[0]

    # Save to Cosmos
    result = {
        "id": str(datetime.utcnow().timestamp()),
        "text": text,
        "sentiment": sentiment_result.sentiment,
        "confidence_scores": {
            "positive": sentiment_result.confidence_scores.positive,
            "neutral": sentiment_result.confidence_scores.neutral,
            "negative": sentiment_result.confidence_scores.negative
        },
        "key_phrases": key_phrases_result.key_phrases,
        "timestamp": datetime.utcnow().isoformat()
    }
    container.create_item(body=result)

    return jsonify(result)

# -----------------------------
# Run app
# -----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
