const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { startCronJob } = require('./cronJob');
const { saveResults } = require('./scraper');
const blacklist = require('../config/blacklist');

const app = express();
const PORT = process.env.PORT || 3001;

// Serve static files
app.use(express.static('public'));

app.get('/', async (req, res) => {
  try {
    const resultsPath = path.join(__dirname, '../data/results.json');
    let results;

    if (await fs.pathExists(resultsPath)) {
      results = await fs.readJSON(resultsPath);
    } else {
      results = await saveResults(); // Initial run if no data exists
    }

    // Filter out blacklisted tokens before displaying
    const filteredTickers = Object.entries(results.tickers)
      .filter(([ticker]) => !blacklist.includes(ticker))
      .reduce((obj, [key, value]) => ({
        ...obj,
        [key]: value
      }), {});

    results.tickers = filteredTickers;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Crypto Ticker Mentions</title>
          <link rel="stylesheet" href="/styles.css">
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

    res.send(html);
  } catch (error) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

// Start the server and cron job
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startCronJob();
}); 