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
 * Format date in a way that Google Sheets will interpret as a proper date string
 * @param {Date} date - The date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  // Format as MM/DD/YYYY HH:MM:SS which Google Sheets recognizes better
  return `${month}/${day}/${year} ${hours}:${minutes}:${seconds}`;
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

    // Format the timestamp in a way Google Sheets will recognize as a date
    const now = new Date();
    const timestamp = formatDate(now);

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
