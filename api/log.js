const { logTapToSheet } = require('../lib/sheets');

/**
 * Serverless function handler for logging taps with new aggregated system
 *
 * @param {import('http').IncomingMessage} req - HTTP request object
 * @param {import('http').ServerResponse} res - HTTP response object
 */
module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Parse query parameters
    const { url } = req;
    const queryParams = new URL(url, 'https://example.com').searchParams;

    const employee = queryParams.get('employee') || 'unknown';
    const business = queryParams.get('business') || 'unknown';
    const location = queryParams.get('location') || 'unknown';

    console.log(
      `Processing tap: Employee=${employee}, Business=${business}, Location=${location}`
    );

    // Log the tap data and update all sheets
    const logResult = await logTapToSheet({
      employee,
      business,
      location,
    });

    if (logResult.success) {
      console.log('Successfully logged tap and updated summary');
    } else {
      console.error('Failed to log tap:', logResult.error);
    }

    // Always redirect to maintain user experience
    res.writeHead(302, { Location: 'https://lcsteak.info' });
    res.end();
  } catch (error) {
    console.error('Error processing tap:', error);

    // Still redirect on error
    res.writeHead(302, { Location: 'https://lcsteak.info' });
    res.end();
  }
};
