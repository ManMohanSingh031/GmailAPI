// Import necessary modules
const { google } = require("googleapis");
const nodemailer = require("nodemailer");
const readline = require("readline");

// Your Gmail API credentials
const credentials = require("./credentials.json");

// Scopes needed for Gmail API
const SCOPES = ["https://www.googleapis.com/auth/gmail.modify"];

// Function to authorize and get OAuth2 client
async function authorize() {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    // Load token from file or obtain a new one
    const token = require("./token.json");
    oAuth2Client.setCredentials(token);
    return oAuth2Client;
  } catch (err) {
    return getAccessToken(oAuth2Client);
  }
}

// Function to get access token interactively
async function getAccessToken(oAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log(`Authorize this app by visiting this URL: ${authUrl}`);

  // Wait for the user to input the code
  const code = await new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter the code from the URL here: ", (code) => {
      rl.close();
      resolve(code);
    });
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  return tokens;
}

// Function to create Gmail API client
async function createGmailClient() {
  const oAuth2Client = await authorize();
  return google.gmail({ version: "v1", auth: oAuth2Client });
}

// Function to send an email
async function sendEmail(to, subject, body) {
  const oAuth2Client = await authorize();
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      type: "OAuth2",
      user: "manmohansingh8422@gmail.com", // Your Gmail address
      clientId: credentials.installed.client_id,
      clientSecret: credentials.installed.client_secret,
      refreshToken: oAuth2Client.credentials.refresh_token,
      accessToken: oAuth2Client.credentials.access_token,
    },
  });

  const mailOptions = {
    from: "manmohansingh8422@gmail.com",
    to,
    subject,
    text: body,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      return console.log(error);
    }
    console.log("Email sent: %s", info.messageId);
  });
}

// Function to check for new emails
async function checkEmails(gmail) {
  try {
    const response = await gmail.users.messages.list({
      userId: "me",
      labelIds: ["INBOX"],
    });

    const messages = response.data.messages;

    for (const message of messages) {
      const messageId = message.id;
      const threadId = message.threadId;

      // Check if the thread has been replied to
      const isReplied = await isThreadReplied(gmail, threadId);

      if (!isReplied) {
        // Thread has not been replied to, reply to the email
        await replyToEmail(gmail, messageId);
      }
    }
  } catch (error) {
    console.error("Error checking emails:", error);
  }
}

// Function to check if a thread has been replied to
async function isThreadReplied(gmail, threadId) {
  try {
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
    });

    const messages = response.data.messages;

    // Check if any of the messages in the thread are sent by the authenticated user
    return messages.some((message) => message.labelIds.includes("SENT"));
  } catch (error) {
    console.error("Error checking thread:", error);
    return false;
  }
}

// Function to reply to an email
async function replyToEmail(gmail, messageId) {
  try {
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
    });

    const message = response.data;

    // Extract sender email address
    const sender = message.payload.headers.find(
      (header) => header.name === "From"
    ).value;

    // Customize reply content
    const replySubject = "Re: " + message.payload.subject;
    const replyBody = `Thank you for your email, ${sender}! Your message has been received.`;

    // Send the reply
    await sendEmail(sender, replySubject, replyBody);

    // Remove the INBOX label (move to another label)
    await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      resource: {
        removeLabelIds: ["INBOX"],
        addLabelIds: [], // Customize the label name
      },
    });

    console.log(`Replied to email from ${sender}.`);
  } catch (error) {
    console.error("Error replying to email:", error);
  }
}

// Function to run the app in intervals
async function runApplicaion() {
  const gmail = await createGmailClient();

  // Run the application every 45 to 120 seconds
  setInterval(async () => {
    await checkEmails(gmail);
  }, Math.floor(Math.random() * (120000 - 45000 + 1)) + 45000);
}

// Start the application
runApplicaion();
