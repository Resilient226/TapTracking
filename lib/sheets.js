const { google } = require('googleapis');

// Spreadsheet IDs
const TAP_SPREADSHEET_ID = '1-es6H3GYw8l85hAfSPyKeqmf6Tir6b4kreiovAnqlOc';
const GOALS_SPREADSHEET_ID = '12nAMIJneD9vAsts-APoSLdmD2P3nItaETnK4uQX9qZE';

// Initialize the Google Sheets API client
function getAuthClient() {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);

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
 * Get week number of the year
 */
function getWeekNumber(date) {
  const d = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Format date and time components
 */
function getDateTimeComponents(date) {
  // Convert to EST/EDT timezone
  const easternTime = new Date(
    date.toLocaleString('en-US', { timeZone: 'America/New_York' })
  );

  const year = easternTime.getFullYear();
  const month = String(easternTime.getMonth() + 1).padStart(2, '0');
  const day = String(easternTime.getDate()).padStart(2, '0');
  const hour = easternTime.getHours(); // 24-hour format (0-23)
  const week = getWeekNumber(easternTime);

  return {
    timestamp: `${year}-${month}-${day} ${String(hour).padStart(
      2,
      '0'
    )}:${String(easternTime.getMinutes()).padStart(2, '0')}:${String(
      easternTime.getSeconds()
    ).padStart(2, '0')}`,
    hour: hour,
    day: `${year}-${month}-${day}`,
    week: week,
    month: `${year}-${month}`,
    year: year,
  };
}

/**
 * Ensure Raw Data and Summary sheets exist
 */
async function ensureSheetsExist(sheets) {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: TAP_SPREADSHEET_ID,
      includeGridData: false,
    });

    const existingSheets = spreadsheet.data.sheets.map(
      (sheet) => sheet.properties.title
    );
    const sheetsToCreate = [];

    if (!existingSheets.includes('Raw Data')) {
      sheetsToCreate.push({
        addSheet: {
          properties: { title: 'Raw Data' },
        },
      });
    }

    if (!existingSheets.includes('Summary')) {
      sheetsToCreate.push({
        addSheet: {
          properties: { title: 'Summary' },
        },
      });
    }

    if (sheetsToCreate.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: TAP_SPREADSHEET_ID,
        resource: { requests: sheetsToCreate },
      });
    }

    // Add headers if sheets were just created
    if (
      sheetsToCreate.some((req) => req.addSheet.properties.title === 'Raw Data')
    ) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: TAP_SPREADSHEET_ID,
        range: 'Raw Data!A1:H1',
        valueInputOption: 'RAW',
        resource: {
          values: [
            [
              'Timestamp',
              'Employee',
              'Location',
              'Restaurant',
              'Hour',
              'Day',
              'Week',
              'Month',
            ],
          ],
        },
      });
    }

    if (
      sheetsToCreate.some((req) => req.addSheet.properties.title === 'Summary')
    ) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: TAP_SPREADSHEET_ID,
        range: 'Summary!A1:J1',
        valueInputOption: 'RAW',
        resource: {
          values: [
            [
              'Employee',
              'Location',
              'Taps Today',
              'Daily Goal',
              '% of Goal',
              'Status',
              'Taps Week',
              'Weekly Goal',
              'Taps Month',
              'Monthly Goal',
            ],
          ],
        },
      });
    }
  } catch (error) {
    console.error('Error ensuring sheets exist:', error);
    throw error;
  }
}

/**
 * Get goals for an employee from the Goals spreadsheet
 */
async function getGoalsForEmployee(sheets, employee, location) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: GOALS_SPREADSHEET_ID,
      range: 'Form Responses 1!A:F',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return { daily: 0, weekly: 0, monthly: 0 };

    // Find the most recent goal entry for this employee/location
    let latestGoal = null;
    let latestTimestamp = null;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] === employee && row[2] === location) {
        const timestamp = new Date(row[0]);
        if (!latestTimestamp || timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestGoal = {
            daily: parseInt(row[3]) || 0,
            weekly: parseInt(row[4]) || 0,
            monthly: parseInt(row[5]) || 0,
          };
        }
      }
    }

    return latestGoal || { daily: 0, weekly: 0, monthly: 0 };
  } catch (error) {
    console.error('Error getting goals:', error);
    return { daily: 0, weekly: 0, monthly: 0 };
  }
}

/**
 * Count taps for different time periods
 */
async function countTaps(sheets, employee, location, currentDate) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TAP_SPREADSHEET_ID,
      range: 'Raw Data!A:H',
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return { today: 0, week: 0, month: 0 };

    const dateComponents = getDateTimeComponents(currentDate);
    let todayCount = 0;
    let weekCount = 0;
    let monthCount = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (row[1] === employee && row[2] === location) {
        // Check if tap matches time periods
        if (row[5] === dateComponents.day) todayCount++;
        if (parseInt(row[6]) === dateComponents.week) weekCount++;
        if (row[7] === dateComponents.month) monthCount++;
      }
    }

    // Include the current tap in the count
    todayCount++;
    weekCount++;
    monthCount++;

    return { today: todayCount, week: weekCount, month: monthCount };
  } catch (error) {
    console.error('Error counting taps:', error);
    return { today: 1, week: 1, month: 1 }; // At least count current tap
  }
}

/**
 * Update or create summary entry
 */
async function updateSummary(sheets, employee, location, tapCounts, goals) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: TAP_SPREADSHEET_ID,
      range: 'Summary!A:J',
    });

    const rows = response.data.values || [];
    let rowIndex = -1;

    // Find existing row for this employee/location
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === employee && rows[i][1] === location) {
        rowIndex = i + 1; // +1 for 1-based indexing
        break;
      }
    }

    // Calculate percentages and status
    const dailyPercent =
      goals.daily > 0 ? Math.round((tapCounts.today / goals.daily) * 100) : 0;
    const dailyStatus = tapCounts.today >= goals.daily ? 'Met' : 'Not Met';

    const summaryRow = [
      employee,
      location,
      tapCounts.today,
      goals.daily,
      `${dailyPercent}%`,
      dailyStatus,
      tapCounts.week,
      goals.weekly,
      tapCounts.month,
      goals.monthly,
    ];

    if (rowIndex > 0) {
      // Update existing row
      await sheets.spreadsheets.values.update({
        spreadsheetId: TAP_SPREADSHEET_ID,
        range: `Summary!A${rowIndex}:J${rowIndex}`,
        valueInputOption: 'RAW',
        resource: { values: [summaryRow] },
      });
    } else {
      // Add new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: TAP_SPREADSHEET_ID,
        range: 'Summary!A:J',
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [summaryRow] },
      });
    }
  } catch (error) {
    console.error('Error updating summary:', error);
    throw error;
  }
}

/**
 * Main function to log tap data
 */
async function logTapToSheet(tapData) {
  try {
    const sheets = getSheetsApi();
    const now = new Date();
    const dateComponents = getDateTimeComponents(now);

    // Ensure sheets exist
    await ensureSheetsExist(sheets);

    const employee = tapData.employee || 'unknown';
    const location = tapData.location || 'unknown';
    const business = tapData.business || 'unknown';

    // 1. Log to Raw Data sheet
    const rawDataRow = [
      dateComponents.timestamp,
      employee,
      location,
      business,
      dateComponents.hour,
      dateComponents.day,
      dateComponents.week,
      dateComponents.month,
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: TAP_SPREADSHEET_ID,
      range: 'Raw Data!A:H',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: [rawDataRow] },
    });

    // 2. Get goals for this employee/location
    const goals = await getGoalsForEmployee(sheets, employee, location);

    // 3. Count current taps
    const tapCounts = await countTaps(sheets, employee, location, now);

    // 4. Update summary sheet
    await updateSummary(sheets, employee, location, tapCounts, goals);

    return { success: true };
  } catch (error) {
    console.error('Error logging tap:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  logTapToSheet,
};
