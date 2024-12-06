require('dotenv').config();
const Snoowrap = require('snoowrap');

const reddit = new Snoowrap({
  userAgent: 'test app by /u/SourceKinesis',
  clientId: process.env.REDDIT_CLIENT_ID,
  clientSecret: process.env.REDDIT_CLIENT_SECRET,
  username: process.env.REDDIT_USERNAME,
  password: process.env.REDDIT_PASSWORD
});

// List of crypto-related subreddits to monitor
const CRYPTO_SUBREDDITS = [
  'CryptoMoonShots',
  'SatoshiStreetBets',
  'CryptoMarkets',
  'altcoin',
  'CryptoCurrency',
  'memecoins'
];

// Regular expression to match potential crypto tickers (3-5 characters in all caps)
const TICKER_REGEX = /\b[A-Z]{3,5}\b/g;

// Helper function to add delay between requests
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function getTickerMentions(subreddit, timeFilter = 'day', limit = 10) { // reduced from 15 to 10 posts
  try {
    const posts = await reddit.getSubreddit(subreddit).getHot({limit: limit});
    const tickerCounts = {};
    
    for (const post of posts) {
      // Increased delay between posts from 2s to 4s
      await delay(4000);
      
      // Get tickers from title
      const titleTickers = post.title.match(TICKER_REGEX) || [];
      const contentTickers = post.selftext.match(TICKER_REGEX) || [];
      
      try {
        // Reduced depth from 5 to 3
        const comments = await post.expandReplies({limit: Infinity, depth: 3});
        const commentTickers = [];
        
        // Recursive function to process comment tree
        function processComment(comment) {
          if (comment.body) {
            const tickers = comment.body.match(TICKER_REGEX) || [];
            commentTickers.push(...tickers);
          }
          
          if (comment.replies) {
            comment.replies.forEach(reply => processComment(reply));
          }
        }
        
        // Process all comments
        if (comments.comments) {
          comments.comments.forEach(comment => processComment(comment));
        }
        
        // Combine and count tickers from title, content and comments
        const tickers = [...titleTickers, ...contentTickers, ...commentTickers];
        tickers.forEach(ticker => {
          tickerCounts[ticker] = (tickerCounts[ticker] || 0) + 1;
        });
      } catch (commentError) {
        console.error(`Error processing comments for post in r/${subreddit}:`, commentError.message);
        // Add extra delay when hitting rate limit
        if (commentError.message.includes('429')) {
          console.log('Rate limit hit, waiting 30 seconds...');
          await delay(30000); // Wait 30 seconds when we hit rate limit
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
  
  for (const subreddit of CRYPTO_SUBREDDITS) {
    console.log(`Scanning r/${subreddit}...`);
    const subredditTickers = await getTickerMentions(subreddit);
    
    Object.entries(subredditTickers).forEach(([ticker, count]) => {
      allTickerCounts[ticker] = (allTickerCounts[ticker] || 0) + count;
    });
    
    // Increased delay between subreddits from 5s to 10s
    await delay(10000);
  }
  
  // Sort by mention count and return top results
  const sortedTickers = Object.entries(allTickerCounts)
    .sort(([,a], [,b]) => b - a)
    .reduce((obj, [key, value]) => ({
      ...obj,
      [key]: value
    }), {});
    
  return sortedTickers;
}

// Run the analysis
async function main() {
  try {
    console.log('Starting ticker analysis...');
    const tickerMentions = await getAllSubredditsTickerMentions();
    
    console.log('\nMost mentioned tickers across all monitored subreddits:');
    Object.entries(tickerMentions).slice(0, 20).forEach(([ticker, count]) => {
      console.log(`${ticker}: ${count} mentions`);
    });
  } catch (error) {
    console.error('Error:', error);
  }
}

main();

