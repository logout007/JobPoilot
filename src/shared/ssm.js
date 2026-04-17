// ── SSM Parameter Store helper
// Fetches decrypted parameters from AWS Systems Manager.
// Never throws — returns empty string on failure.

import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({ region: 'ap-south-1' });

/**
 * Fetches a decrypted SSM parameter by name.
 * @param {string} name - The SSM parameter name.
 * @returns {Promise<string>} The parameter value, or '' on error.
 */
export async function getParam(name) {
  try {
    const command = new GetParameterCommand({ Name: name, WithDecryption: true });
    const response = await ssm.send(command);
    return response.Parameter.Value;
  } catch (error) {
    console.error(`[SSM] Failed to fetch parameter "${name}":`, error.message);
    return '';
  }
}
