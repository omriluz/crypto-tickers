require('dotenv').config();
const Snoowrap = require('snoowrap');
const fs = require('fs-extra');
const path = require('path');
const blacklist = require('../config/blacklist');

const reddit = new Snoowrap({
  userAgent: 'test app by /u/SourceKinesis',
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD
});

const CRYPTO_SUBREDDITS = [
  'CryptoMoonShots',
  'SatoshiStreetBets',
  'CryptoMarkets'
];

const TICKER_REGEX = /\b[A-Z]{3,5}\b/g;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getTickerMentions(subreddit, timeFilter = 'day', limit = 5) {
  try {
    const posts = await reddit.getSubreddit(subreddit).getHot({limit: limit});
    const tickerCounts = {};
    
    for (const post of posts) {
      await delay(2000);
      
      const titleTickers = post.title.match(TICKER_REGEX) || [];
      const contentTickers = post.selftext.match(TICKER_REGEX) || [];
      
      try {
        const comments = await post.expandReplies({limit: 10, depth: 2});
        const commentTickers = [];
        
        function processComment(comment) {
          if (comment.body) {
            const tickers = comment.body.match(TICKER_REGEX) || [];
            commentTickers.push(...tickers);
          }
          
          if (comment.replies) {
            comment.replies.forEach(reply => processComment(reply));
          }
        }
        
        if (comments.comments) {
          comments.comments.forEach(comment => processComment(comment));
        }
        
        const tickers = [...titleTickers, ...contentTickers, ...commentTickers];
        tickers.forEach(ticker => {
          if (!blacklist.includes(ticker)) {
            tickerCounts[ticker] = (tickerCounts[ticker] || 0) + 1;
          }
        });
      } catch (commentError) {
        console.error(`Error processing comments for post in r/${subreddit}:`, commentError.message);
        if (commentError.message.includes('429')) {
          console.log('Rate limit hit, waiting 15 seconds...');
          await delay(15000);
        }
      }
    }
    
    return tickerCounts;
  } catch (error) {
    console.error(`Error fetching from r/${subreddit}:`, error.message);
    return {};
  }
}

async function getAllSubredditsTickerMentions() {
  const allTickerCounts = {};
  let errors = [];
  
  for (const subreddit of CRYPTO_SUBREDDITS) {
    console.log(`Scanning r/${subreddit}...`);
    try {
      const subredditTickers = await getTickerMentions(subreddit);
      
      Object.entries(subredditTickers).forEach(([ticker, count]) => {
        allTickerCounts[ticker] = (allTickerCounts[ticker] || 0) + count;
      });
    } catch (error) {
      errors.push(`Error in r/${subreddit}: ${error.message}`);
    }
    
    await delay(5000);
  }
  
  return { tickers: allTickerCounts, errors };
}

async function saveResults() {
  console.log('Starting ticker analysis...');
  const { tickers, errors } = await getAllSubredditsTickerMentions();
  
  const results = {
    updatedAt: new Date().toISOString(),
    tickers: Object.entries(tickers)
      .sort(([,a], [,b]) => b - a)
      .reduce((obj, [key, value]) => ({
        ...obj,
        [key]: value
      }), {}),
    errors
  };

  await fs.writeJSON(path.join(__dirname, '../data/results.json'), results, { spaces: 2 });
  return results;
}

module.exports = { saveResults }; 