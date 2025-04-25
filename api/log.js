const { logTapToSheet } = require('../lib/sheets');

/**
 * Serverless function handler for logging taps
 *
 * @param {import('http').IncomingMessage} req - HTTP request object
 * @param {import('http').ServerResponse} res - HTTP response object
 */
module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
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
      `Logging tap: Employee=${employee}, Business=${business}, Location=${location}`
    );

    // Log the tap data to Google Sheets
    const logResult = await logTapToSheet({
      employee,
      business,
      location,
    });

    if (!logResult.success) {
      console.error('Failed to log tap:', logResult.error);
    } else {
      console.log('Successfully logged tap to Google Sheets');
    }

    // Always redirect to the destination URL, even if logging fails
    // This ensures a seamless user experience
    res.writeHead(302, { Location: 'https://lcsteak.info' });
    res.end();
  } catch (error) {
    console.error('Error processing tap:', error);

    // Still redirect on error to maintain user experience
    res.writeHead(302, { Location: 'https://lcsteak.info' });
    res.end();
  }
};
