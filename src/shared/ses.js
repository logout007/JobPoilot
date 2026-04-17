// ── SES email helper
// Sends emails via Amazon Simple Email Service.
// Never throws — catches and logs errors.

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({ region: 'ap-south-1' });

/**
 * Sends an HTML email via SES.
 * Source address is the same as the recipient (verified identity).
 * @param {string} to - Recipient email address.
 * @param {string} subject - Email subject line.
 * @param {string} htmlBody - HTML content of the email body.
 * @returns {Promise<void>}
 */
export async function sendEmail(to, subject, htmlBody) {
  try {
    const command = new SendEmailCommand({
      Source: to,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject },
        Body: { Html: { Data: htmlBody } },
      },
    });

    await ses.send(command);
  } catch (error) {
    console.error(`[SES] Failed to send email to "${to}":`, error.message);
  }
}
