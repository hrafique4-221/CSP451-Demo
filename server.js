const express = require("express");
const bodyParser = require("body-parser");
const fetch = require("node-fetch");
const { CosmosClient } = require("@azure/cosmos");

const app = express();
app.use(bodyParser.json());
app.use(express.static(".")); // serve index.html

// === HARD-CODED KEYS ===
const TEXT_ANALYTICS_KEY = "167bc78bf8dd431a808011ad307c291b";
const TEXT_ANALYTICS_ENDPOINT = "https://eastus.api.cognitive.microsoft.com/";

const COSMOS_KEY = "XpRqcSAwwZ3Mhvh6kwvHT6uBkbnVgYHqsXayKihvc1tJdn8f3y1Zn8JZJpJ3357b6oR5Qw13fAyVACDbFdTOdw==";
const COSMOS_ENDPOINT = "https://cosmos1890114.documents.azure.com:443/";

// Cosmos DB setup
const cosmosClient = new CosmosClient({
  endpoint: COSMOS_ENDPOINT,
  key: COSMOS_KEY
});
const database = cosmosClient.database("SentimentDB");
const container = database.container("Results");

// POST /analyze
app.post("/analyze", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    // Sentiment
    const sentimentResponse = await fetch(`${TEXT_ANALYTICS_ENDPOINT}text/analytics/v3.1/sentiment`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": TEXT_ANALYTICS_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ documents: [{ id: "1", language: "en", text }] })
    });
    const sentimentData = await sentimentResponse.json();
    const sentiment = sentimentData.documents[0];

    // Key phrases
    const keyPhrasesResponse = await fetch(`${TEXT_ANALYTICS_ENDPOINT}text/analytics/v3.1/keyPhrases`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": TEXT_ANALYTICS_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ documents: [{ id: "1", language: "en", text }] })
    });
    const keyPhrasesData = await keyPhrasesResponse.json();
    const keyPhrases = keyPhrasesData.documents[0]?.keyPhrases || [];

    // Save to Cosmos DB
    await container.items.create({
      id: new Date().getTime().toString(),
      text,
      sentiment: sentiment.sentiment,
      confidenceScores: sentiment.confidenceScores,
      keyPhrases,
      timestamp: new Date().toISOString()
    });

    res.json({ sentiment: sentiment.sentiment, confidenceScores: sentiment.confidenceScores, keyPhrases });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error analyzing text" });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
