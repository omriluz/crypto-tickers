const cron = require('node-cron');
const { saveResults } = require('./scraper');

function startCronJob() {
  // Run every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    console.log('Running scheduled ticker update...');
    try {
      await saveResults();
      console.log('Update completed successfully');
    } catch (error) {
      console.error('Error in scheduled update:', error);
    }
  });
}

module.exports = { startCronJob }; 