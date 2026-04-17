// ── API Gateway Lambda Handler
// Routes requests to the appropriate handler based on method + resource.

import { handleGetJobs, handleGetJob, handleUpdateJobStatus, handleAddNote, handleSetReminder } from './routes/jobs.js';
import { handleGetGrades, handleGetPlatforms, handleGetFunnel } from './routes/analytics.js';

// CORS headers applied to every response
const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Wraps a route handler response with CORS headers.
 * @param {{ statusCode: number, body: string }} result
 * @returns {{ statusCode: number, headers: object, body: string }}
 */
function withHeaders(result) {
  return {
    statusCode: result.statusCode,
    headers: CORS_HEADERS,
    body: result.body,
  };
}

/**
 * Lambda handler entry point.
 * @param {object} event - API Gateway proxy event
 * @returns {Promise<{ statusCode: number, headers: object, body: string }>}
 */
export const handler = async (event) => {
  console.log('[API] Request:', {
    method: event.httpMethod,
    path: event.path,
    resource: event.resource,
  });

  // Handle OPTIONS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' };
  }

  try {
    const { httpMethod, resource, pathParameters, queryStringParameters, body } = event;

    // ── /jobs routes
    if (httpMethod === 'GET' && resource === '/jobs') {
      return withHeaders(await handleGetJobs(queryStringParameters));
    }

    if (httpMethod === 'GET' && resource === '/jobs/{jobId}') {
      return withHeaders(await handleGetJob(pathParameters.jobId));
    }

    if (httpMethod === 'PUT' && resource === '/jobs/{jobId}/status') {
      return withHeaders(await handleUpdateJobStatus(pathParameters.jobId, body));
    }

    // ── /jobs/{jobId}/notes route
    if (httpMethod === 'POST' && resource === '/jobs/{jobId}/notes') {
      return withHeaders(await handleAddNote(pathParameters.jobId, body));
    }

    // ── /jobs/{jobId}/reminder route
    if (httpMethod === 'PUT' && resource === '/jobs/{jobId}/reminder') {
      return withHeaders(await handleSetReminder(pathParameters.jobId, body));
    }

    // ── /analytics routes
    if (httpMethod === 'GET' && resource === '/analytics/grades') {
      return withHeaders(await handleGetGrades());
    }

    if (httpMethod === 'GET' && resource === '/analytics/platforms') {
      return withHeaders(await handleGetPlatforms());
    }

    if (httpMethod === 'GET' && resource === '/analytics/funnel') {
      return withHeaders(await handleGetFunnel());
    }

    // Unknown route
    return withHeaders({
      statusCode: 404,
      body: JSON.stringify({ error: 'Route not found' }),
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return withHeaders({
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    });
  }
};
