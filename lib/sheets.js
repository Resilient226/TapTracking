const { google } = require('googleapis');

// Initialize the Google Sheets API client
function getAuthClient() {
  try {
    // Parse the service account credentials from the environment variable
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

    // Create a JWT auth client using the service account
    const auth = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/spreadsheets']
    );

    return auth;
  } catch (error) {
    console.error('Error initializing auth client:', error);
    throw new Error('Failed to initialize Google Sheets authentication');
  }
}

// Get the Google Sheets API instance
function getSheetsApi() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Log a new tap to the Tap Logs sheet
 * @param {Object} tapData - Object containing employee, business, location
 * @returns {Promise<Object>} - Response from the API
 */
async function logTapToSheet(tapData) {
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Get the actual tab name from the spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    // Use the first sheet if available, otherwise default to "Sheet1"
    const sheetTitle =
      (spreadsheet.data.sheets &&
        spreadsheet.data.sheets[0] &&
        spreadsheet.data.sheets[0].properties.title) ||
      'Sheet1';

    console.log(`Using sheet: ${sheetTitle}`);

    // Format the timestamp
    const now = new Date();
    const timestamp = now.toISOString().replace('T', ' ').substring(0, 19);

    // Prepare row data for Tap Logs sheet
    const values = [
      [
        timestamp,
        tapData.employee || 'unknown',
        tapData.location || 'unknown',
        tapData.business || 'unknown',
      ],
    ];

    // Append the row to the Tap Logs sheet
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetTitle}!A:D`, // Using A:D to ensure we append to the correct columns
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values,
      },
    });

    return {
      success: true,
      response,
    };
  } catch (error) {
    console.error('Error logging tap to sheet:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  logTapToSheet,
};
