const { google } = require('googleapis');

function getAuthClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  return new google.auth.JWT(
    credentials.client_email,
    null,
    credentials.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
}

module.exports = async (req, res) => {
  try {
    const sheets = google.sheets({ version: 'v4', auth: getAuthClient() });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: '12nAMIJneD9vAsts-APoSLdmD2P3nItaETnK4uQX9qZE',
      range: 'Form Responses 1!A:F',
    });

    res.json({
      success: true,
      data: response.data.values,
      rowCount: response.data.values?.length || 0,
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
    });
  }
};
