import { google } from 'googleapis';

function getAuth(scopes) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!email || !key) return null;
  return new google.auth.JWT(email, null, key.replace(/\\n/g, '\n'), scopes);
}

// ─── Sheets ───────────────────────────────────────────────────────────────────

export async function logInterviewToSheet(interview) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const auth = getAuth(['https://www.googleapis.com/auth/spreadsheets']);
  if (!sheetId || !auth) return;

  const sheets = google.sheets({ version: 'v4', auth });
  const sc = interview.score || {};

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Interviews!A1',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        new Date().toISOString(),
        interview.candidateName || '',
        interview.candidateEmail || '',
        interview.candidatePhone || '',
        interview.position || '',
        interview.location || '',
        interview.currentCTC || '',
        interview.expectedCTC || '',
        interview.noticePeriod || '',
        sc.totalScore ?? '',
        sc.recommendation || '',
        interview.status || '',
        interview.id,
      ]],
    },
  });
}

export async function logHireDecisionToSheet(interview) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const auth = getAuth(['https://www.googleapis.com/auth/spreadsheets']);
  if (!sheetId || !auth) return;

  const sheets = google.sheets({ version: 'v4', auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'Decisions!A1',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [[
        new Date().toISOString(),
        interview.candidateName || '',
        interview.position || '',
        interview.adminAction || '',
        interview.score?.totalScore ?? '',
        interview.id,
      ]],
    },
  });
}

// ─── Drive ────────────────────────────────────────────────────────────────────

export async function createCandidateDriveFolder(interview) {
  const parentFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  const auth = getAuth(['https://www.googleapis.com/auth/drive']);
  if (!parentFolderId || !auth) return null;

  const drive = google.drive({ version: 'v3', auth });

  const folder = await drive.files.create({
    requestBody: {
      name: `${interview.candidateName} — ${interview.position} — ${interview.id}`,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    },
    fields: 'id, webViewLink',
  });

  return folder.data;
}
