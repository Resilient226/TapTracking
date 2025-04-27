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
 * Ensure the summary sheet exists and has the correct headers
 * @param {Object} sheets - The Google Sheets API instance
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @returns {Promise<string>} - The name of the summary sheet
 */
async function ensureSummarySheetExists(sheets, spreadsheetId) {
  try {
    // Get the list of sheets in the spreadsheet
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
      includeGridData: false,
    });

    const sheetsList = spreadsheet.data.sheets || [];

    // Check if "Tap Log Summary" sheet exists
    const summarySheet = sheetsList.find(
      (sheet) => sheet.properties.title === 'Tap Log Summary'
    );

    if (summarySheet) {
      console.log('Summary sheet already exists');
      return 'Tap Log Summary';
    }

    // If not, create the summary sheet
    console.log('Creating summary sheet');
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            addSheet: {
              properties: {
                title: 'Tap Log Summary',
              },
            },
          },
        ],
      },
    });

    // Add headers to the summary sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Tap Log Summary!A1:D1',
      valueInputOption: 'RAW',
      resource: {
        values: [['Employee ID', 'Business', 'Total Taps', 'Last Tap']],
      },
    });

    return 'Tap Log Summary';
  } catch (error) {
    console.error('Error ensuring summary sheet exists:', error);
    throw error;
  }
}

/**
 * Get the name of the main log sheet
 * @param {Object} sheets - The Google Sheets API instance
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @returns {Promise<string>} - The name of the main log sheet
 */
async function getMainSheetName(sheets, spreadsheetId) {
  // Get the first sheet in the spreadsheet
  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId,
    includeGridData: false,
  });

  // If we have sheets, get the name of the first one, otherwise default to "Sheet1"
  if (spreadsheet.data.sheets && spreadsheet.data.sheets.length > 0) {
    const mainSheet = spreadsheet.data.sheets.find(
      (sheet) => sheet.properties.title !== 'Tap Log Summary'
    );

    if (mainSheet) {
      return mainSheet.properties.title;
    }
  }

  return 'Sheet1';
}

/**
 * Update or add a row in the summary sheet
 * @param {Object} sheets - The Google Sheets API instance
 * @param {string} spreadsheetId - The ID of the spreadsheet
 * @param {string} employee - The employee ID/name
 * @param {string} business - The business name
 * @param {string} timestamp - The timestamp of the tap
 * @returns {Promise<void>}
 */
async function updateSummarySheet(
  sheets,
  spreadsheetId,
  employee,
  business,
  timestamp
) {
  try {
    // Get the summary data
    const summaryData = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Tap Log Summary!A2:D',
    });

    const rows = summaryData.data.values || [];

    // Look for matching employee and business
    const rowIndex = rows.findIndex(
      (row) => row[0] === employee && row[1] === business
    );

    if (rowIndex !== -1) {
      // Update existing entry
      const totalTaps = parseInt(rows[rowIndex][2] || '0', 10) + 1;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `Tap Log Summary!C${rowIndex + 2}:D${rowIndex + 2}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[totalTaps, timestamp]],
        },
      });
    } else {
      // Add new entry
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Tap Log Summary!A:D',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [[employee, business, 1, timestamp]],
        },
      });
    }
  } catch (error) {
    console.error('Error updating summary sheet:', error);
    throw error;
  }
}

/**
 * Log a new tap to both the main log sheet and the summary sheet
 * @param {Object} tapData - Object containing employee, business, location
 * @returns {Promise<Object>} - Response from the API
 */
async function logTapToSheet(tapData) {
  try {
    const sheets = getSheetsApi();
    const spreadsheetId = process.env.SPREADSHEET_ID;

    // Get the main sheet name
    const mainSheetName = await getMainSheetName(sheets, spreadsheetId);
    console.log(`Using main sheet: ${mainSheetName}`);

    // Ensure the summary sheet exists
    await ensureSummarySheetExists(sheets, spreadsheetId);

    // Format the timestamp - use a formula to force Google Sheets to interpret as a date
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const year = now.getFullYear();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    // Use a formula to force Google Sheets to interpret as a date
    const timestampFormula = `=DATE(${year},${month},${day})+TIME(${hours},${minutes},${seconds})`;

    // Also create a human-readable timestamp for the summary
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = String(hours % 12 || 12).padStart(2, '0');
    const readableTimestamp = `${month}/${day}/${year} ${formattedHours}:${minutes}:${seconds} ${ampm}`;

    // Extract employee and business from tapData
    const employee = tapData.employee || 'unknown';
    const business = tapData.business || 'unknown';
    const location = tapData.location || 'unknown';

    // Prepare row data for main log sheet
    const values = [[timestampFormula, employee, location, business]];

    // 1. Append to the main log sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${mainSheetName}!A:D`,
      valueInputOption: 'USER_ENTERED', // For the formula to work
      insertDataOption: 'INSERT_ROWS',
      resource: {
        values,
      },
    });

    // 2. Update the summary sheet
    await updateSummarySheet(
      sheets,
      spreadsheetId,
      employee,
      business,
      readableTimestamp
    );

    return {
      success: true,
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
