const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { saveResults } = require('../src/scraper');
const blacklist = require('../config/blacklist');

const app = express();

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '../public')));

async function generateHTML(results) {
  const filteredTickers = Object.entries(results.tickers)
    .filter(([ticker]) => !blacklist.includes(ticker))
    .reduce((obj, [key, value]) => ({
      ...obj,
      [key]: value
    }), {});

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Crypto Ticker Mentions</title>
        <style>
          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            font-family: Arial, sans-serif;
          }
          
          .updated-at {
            color: #666;
            font-style: italic;
          }
          
          .ticker-list {
            margin-top: 20px;
          }
          
          .ticker-item {
            display: flex;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #eee;
          }
          
          .rank {
            width: 30px;
            font-weight: bold;
          }
          
          .ticker {
            flex: 1;
            font-weight: bold;
            color: #2a5;
          }
          
          .count {
            color: #666;
          }
          
          .errors {
            margin-top: 30px;
            padding: 20px;
            background: #fff5f5;
            border-radius: 5px;
          }
          
          .errors h2 {
            color: #e53e3e;
            margin-top: 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Most Mentioned Crypto Tickers</h1>
          <p class="updated-at">Last Updated: ${new Date(results.updatedAt).toLocaleString()}</p>
          
          <div class="ticker-list">
            ${Object.entries(filteredTickers)
              .slice(0, 20)
              .map(([ticker, count], index) => `
                <div class="ticker-item">
                  <span class="rank">${index + 1}</span>
                  <span class="ticker">${ticker}</span>
                  <span class="count">${count} mentions</span>
                </div>
              `).join('')}
          </div>

          ${results.errors.length > 0 ? `
            <div class="errors">
              <h2>Recent Errors</h2>
              <ul>
                ${results.errors.map(error => `<li>${error}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
        </div>
      </body>
    </html>
  `;
}

// Handle the root path
app.get('/', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../data/results.json');
    let results;

    if (await fs.pathExists(resultsPath)) {
      results = await fs.readJSON(resultsPath);
    } else {
      results = await saveResults(); // Initial run if no data exists
    }

    const html = await generateHTML(results);
    res.send(html);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Handle the update endpoint
app.get('/api/update', async (req, res) => {
  const apiKey = process.env.UPDATE_API_KEY;
  if (apiKey && req.query.key !== apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const results = await saveResults();
    res.json({ success: true, updatedAt: results.updatedAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export a serverless function handler
module.exports = async (req, res) => {
  await app(req, res);
}; 