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

    // Format the timestamp - use a string formatted date that Google Sheets will recognize
    const now = new Date();
    // Format as MM/DD/YYYY HH:MM:SS AM/PM
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = String(hours % 12 || 12).padStart(2, '0');

    // Use a formula to force Google Sheets to interpret as a date
    const timestamp = `=DATE(${year},${month},${day})+TIME(${hours},${minutes},${seconds})`;

    // Also create a human-readable timestamp as fallback
    const readableTimestamp = `${month}/${day}/${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`;

    // Prepare row data for Tap Logs sheet - using the formula in column A
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
      valueInputOption: 'USER_ENTERED', // This is crucial to make the formula work
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
