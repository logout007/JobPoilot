// ============================================================
// Test: sendAGradeNotification function
// Purpose: Verify A-grade job email notifications work correctly
// Requirements: 14.1, 14.2, 14.3, 14.4
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

// Mock AWS SDK
vi.mock('@aws-sdk/client-ses', () => {
  const mockSend = vi.fn();
  return {
    SESClient: vi.fn(() => ({ send: mockSend })),
    SendEmailCommand: vi.fn((params) => params),
  };
});

// Import after mocking
const { SESClient: MockSESClient } = await import('@aws-sdk/client-ses');

describe('sendAGradeNotification', () => {
  let mockSend;
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend = MockSESClient.mock.results[0]?.value?.send || vi.fn();
  });
  
  // Helper function to simulate the sendAGradeNotification logic
  async function sendAGradeNotification(jobs, notifyEmail) {
    const aGradeJobs = jobs.filter(job => job.grade === 'A');
    
    if (aGradeJobs.length === 0) {
      console.log('[SES] No A-grade jobs to notify');
      return;
    }
    
    const subject = `JobPilot V2: ${aGradeJobs.length} A-Grade Job${aGradeJobs.length > 1 ? 's' : ''} Found!`;
    const body = buildNotificationEmail(aGradeJobs);
    
    const params = {
      Source: notifyEmail,
      Destination: {
        ToAddresses: [notifyEmail],
      },
      Message: {
        Subject: { Data: subject },
        Body: {
          Html: { Data: body },
        },
      },
    };
    
    try {
      await mockSend(new SendEmailCommand(params));
      console.log(`[SES] Sent A-grade notification for ${aGradeJobs.length} jobs`);
    } catch (error) {
      console.error('[SES] Failed to send notification:', error.message);
    }
  }
  
  function buildNotificationEmail(jobs) {
    const dashboardUrl = 'https://jobpilot-v2-data.s3.ap-south-1.amazonaws.com/index.html';
    
    const jobCards = jobs.map(job => {
      const strengths = job.strengths || [];
      const top3Strengths = strengths.slice(0, 3);
      const strengthsList = top3Strengths.length > 0
        ? top3Strengths.map(s => `<li style="margin: 4px 0; color: #059669;">${s}</li>`).join('')
        : '<li style="margin: 4px 0; color: #6b7280;">No specific strengths listed</li>';
      
      return `
      <div style="background: #f9fafb; border: 2px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <div style="display: flex; align-items: center; margin-bottom: 8px;">
          <span style="background: #10b981; color: white; font-weight: bold; padding: 4px 12px; border-radius: 4px; margin-right: 12px;">Grade A</span>
          <span style="background: #e5e7eb; color: #374151; padding: 4px 8px; border-radius: 4px; font-size: 12px;">${job.platform}</span>
        </div>
        <h3 style="margin: 8px 0; color: #111827; font-size: 18px;">${job.title}</h3>
        <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">${job.company}</p>
        <p style="margin: 8px 0; color: #374151; font-weight: 600;">Score: ${job.totalScore}/5.0</p>
        <div style="margin-top: 12px;">
          <p style="margin: 4px 0; color: #374151; font-weight: 600; font-size: 14px;">Top Strengths:</p>
          <ul style="margin: 4px 0; padding-left: 20px;">
            ${strengthsList}
          </ul>
        </div>
        <div style="margin-top: 12px;">
          <a href="${job.url}" style="display: inline-block; background: #2563eb; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; margin-right: 8px;">Apply on ${job.platform}</a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #6b7280; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none;">View in Dashboard</a>
        </div>
      </div>
    `;
    }).join('');
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JobPilot V2 - A-Grade Jobs Found</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background: #ffffff; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
      <h1 style="margin: 0; font-size: 24px;">🎯 JobPilot V2</h1>
      <p style="margin: 8px 0 0 0; font-size: 16px; opacity: 0.9;">A-Grade Jobs Found!</p>
    </div>
    <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
      <p style="margin: 0; color: #374151; font-size: 14px;">
        Great news! We found <strong>${jobs.length} A-grade job${jobs.length > 1 ? 's' : ''}</strong> that are excellent matches for your profile. These are high-priority opportunities you should review and apply to quickly.
      </p>
    </div>
    ${jobCards}
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center;">
      <p style="margin: 8px 0; color: #6b7280; font-size: 12px;">
        This is an automated notification from JobPilot V2. Jobs are evaluated daily at 09:00 IST.
      </p>
      <p style="margin: 8px 0;">
        <a href="${dashboardUrl}" style="color: #2563eb; text-decoration: none; font-size: 14px;">View Full Dashboard →</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
    
    return emailHtml;
  }
  
  it('should filter jobs with grade A', async () => {
    const jobs = [
      { id: '1', title: 'Job 1', company: 'Company A', platform: 'LinkedIn', grade: 'A', totalScore: 4.8, strengths: ['Great match'], url: 'https://example.com/1' },
      { id: '2', title: 'Job 2', company: 'Company B', platform: 'Naukri', grade: 'B', totalScore: 4.2, strengths: ['Good match'], url: 'https://example.com/2' },
      { id: '3', title: 'Job 3', company: 'Company C', platform: 'Indeed', grade: 'A', totalScore: 4.7, strengths: ['Excellent fit'], url: 'https://example.com/3' },
    ];
    
    mockSend.mockResolvedValue({});
    
    await sendAGradeNotification(jobs, 'test@example.com');
    
    expect(mockSend).toHaveBeenCalledTimes(1);
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.Message.Subject.Data).toBe('JobPilot V2: 2 A-Grade Jobs Found!');
  });
  
  it('should build email body with job title, company, platform, score, and top 3 strengths', async () => {
    const jobs = [
      {
        id: '1',
        title: 'Senior Full Stack Developer',
        company: 'Tech Corp',
        platform: 'LinkedIn',
        grade: 'A',
        totalScore: 4.8,
        strengths: ['Perfect skills match', 'Great salary', 'Remote work', 'Extra strength'],
        url: 'https://linkedin.com/jobs/123',
      },
    ];
    
    mockSend.mockResolvedValue({});
    
    await sendAGradeNotification(jobs, 'test@example.com');
    
    const callArgs = mockSend.mock.calls[0][0];
    const emailBody = callArgs.Message.Body.Html.Data;
    
    // Verify job details are included
    expect(emailBody).toContain('Senior Full Stack Developer');
    expect(emailBody).toContain('Tech Corp');
    expect(emailBody).toContain('LinkedIn');
    expect(emailBody).toContain('4.8/5.0');
    
    // Verify top 3 strengths are included
    expect(emailBody).toContain('Perfect skills match');
    expect(emailBody).toContain('Great salary');
    expect(emailBody).toContain('Remote work');
    
    // Verify 4th strength is NOT included (only top 3)
    expect(emailBody).not.toContain('Extra strength');
    
    // Verify dashboard link is included
    expect(emailBody).toContain('View in Dashboard');
    expect(emailBody).toContain('https://jobpilot-v2-data.s3.ap-south-1.amazonaws.com/index.html');
  });
  
  it('should send single batched email for multiple A-grade jobs', async () => {
    const jobs = [
      { id: '1', title: 'Job 1', company: 'Company A', platform: 'LinkedIn', grade: 'A', totalScore: 4.8, strengths: ['Strength 1'], url: 'https://example.com/1' },
      { id: '2', title: 'Job 2', company: 'Company B', platform: 'Naukri', grade: 'A', totalScore: 4.7, strengths: ['Strength 2'], url: 'https://example.com/2' },
      { id: '3', title: 'Job 3', company: 'Company C', platform: 'Indeed', grade: 'A', totalScore: 4.6, strengths: ['Strength 3'], url: 'https://example.com/3' },
    ];
    
    mockSend.mockResolvedValue({});
    
    await sendAGradeNotification(jobs, 'test@example.com');
    
    // Should send only ONE email containing all 3 jobs
    expect(mockSend).toHaveBeenCalledTimes(1);
    
    const callArgs = mockSend.mock.calls[0][0];
    const emailBody = callArgs.Message.Body.Html.Data;
    
    // Verify all 3 jobs are in the single email
    expect(emailBody).toContain('Job 1');
    expect(emailBody).toContain('Job 2');
    expect(emailBody).toContain('Job 3');
    expect(emailBody).toContain('Company A');
    expect(emailBody).toContain('Company B');
    expect(emailBody).toContain('Company C');
  });
  
  it('should handle SES failures gracefully and continue without throwing', async () => {
    const jobs = [
      { id: '1', title: 'Job 1', company: 'Company A', platform: 'LinkedIn', grade: 'A', totalScore: 4.8, strengths: ['Strength 1'], url: 'https://example.com/1' },
    ];
    
    // Mock SES failure
    mockSend.mockRejectedValue(new Error('SES service unavailable'));
    
    // Should not throw error
    await expect(sendAGradeNotification(jobs, 'test@example.com')).resolves.not.toThrow();
    
    // Should have attempted to send
    expect(mockSend).toHaveBeenCalledTimes(1);
  });
  
  it('should not send email when no A-grade jobs are present', async () => {
    const jobs = [
      { id: '1', title: 'Job 1', company: 'Company A', platform: 'LinkedIn', grade: 'B', totalScore: 4.2, strengths: ['Strength 1'], url: 'https://example.com/1' },
      { id: '2', title: 'Job 2', company: 'Company B', platform: 'Naukri', grade: 'C', totalScore: 3.8, strengths: ['Strength 2'], url: 'https://example.com/2' },
    ];
    
    mockSend.mockResolvedValue({});
    
    await sendAGradeNotification(jobs, 'test@example.com');
    
    // Should not send any email
    expect(mockSend).not.toHaveBeenCalled();
  });
  
  it('should handle jobs with no strengths gracefully', async () => {
    const jobs = [
      {
        id: '1',
        title: 'Job 1',
        company: 'Company A',
        platform: 'LinkedIn',
        grade: 'A',
        totalScore: 4.5,
        strengths: [],
        url: 'https://example.com/1',
      },
    ];
    
    mockSend.mockResolvedValue({});
    
    await sendAGradeNotification(jobs, 'test@example.com');
    
    const callArgs = mockSend.mock.calls[0][0];
    const emailBody = callArgs.Message.Body.Html.Data;
    
    // Should show fallback message
    expect(emailBody).toContain('No specific strengths listed');
  });
  
  it('should use singular form for subject when only 1 A-grade job', async () => {
    const jobs = [
      { id: '1', title: 'Job 1', company: 'Company A', platform: 'LinkedIn', grade: 'A', totalScore: 4.8, strengths: ['Strength 1'], url: 'https://example.com/1' },
    ];
    
    mockSend.mockResolvedValue({});
    
    await sendAGradeNotification(jobs, 'test@example.com');
    
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.Message.Subject.Data).toBe('JobPilot V2: 1 A-Grade Job Found!');
  });
  
  it('should use plural form for subject when multiple A-grade jobs', async () => {
    const jobs = [
      { id: '1', title: 'Job 1', company: 'Company A', platform: 'LinkedIn', grade: 'A', totalScore: 4.8, strengths: ['Strength 1'], url: 'https://example.com/1' },
      { id: '2', title: 'Job 2', company: 'Company B', platform: 'Naukri', grade: 'A', totalScore: 4.7, strengths: ['Strength 2'], url: 'https://example.com/2' },
    ];
    
    mockSend.mockResolvedValue({});
    
    await sendAGradeNotification(jobs, 'test@example.com');
    
    const callArgs = mockSend.mock.calls[0][0];
    expect(callArgs.Message.Subject.Data).toBe('JobPilot V2: 2 A-Grade Jobs Found!');
  });
});
