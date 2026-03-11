import { Resend } from "resend";

let _resend: Resend | null = null;
function getResend() {
  if (!_resend && process.env.RESEND_API_KEY) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@example.com";
const APP_NAME = "現場報告システム";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
}

async function sendEmail({ to, subject, html }: SendEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.log("[Email] RESEND_API_KEY not set, skipping email:", {
      to,
      subject,
    });
    return { success: true, skipped: true };
  }

  try {
    const resend = getResend();
    if (!resend) return { success: false, error: "Resend not configured" };
    const { data, error } = await resend.emails.send({
      from: `${APP_NAME} <${FROM_EMAIL}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    if (error) {
      console.error("[Email] Send error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("[Email] Unexpected error:", err);
    return { success: false, error: "メール送信に失敗しました" };
  }
}

// ---------------------------------------------------------------------------
// 報告提出時 → 管理者へ通知
// ---------------------------------------------------------------------------
export async function notifyReportSubmitted({
  reporterName,
  siteName,
  reportDate,
  reportId,
  adminEmails,
}: {
  reporterName: string;
  siteName: string;
  reportDate: string;
  reportId: string;
  adminEmails: string[];
}) {
  if (adminEmails.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

  return sendEmail({
    to: adminEmails,
    subject: `[${APP_NAME}] 新規報告: ${siteName} (${reportDate})`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #00D9FF; padding-bottom: 8px;">
          新しい報告が提出されました
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold; width: 120px;">報告者</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${reporterName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">現場</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${siteName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">報告日</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${reportDate}</td>
          </tr>
        </table>
        <a href="${appUrl}/reports/${reportId}" style="display: inline-block; background: #00D9FF; color: #0e0e0e; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 8px;">
          報告を確認する
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          このメールは${APP_NAME}から自動送信されています。
        </p>
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// 承認時 → クライアントへ通知
// ---------------------------------------------------------------------------
export async function notifyReportApproved({
  siteName,
  reportDate,
  reportId,
  clientEmails,
}: {
  siteName: string;
  reportDate: string;
  reportId: string;
  clientEmails: string[];
}) {
  if (clientEmails.length === 0) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

  return sendEmail({
    to: clientEmails,
    subject: `[${APP_NAME}] 報告承認: ${siteName} (${reportDate})`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #22c55e; padding-bottom: 8px;">
          報告が承認されました
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold; width: 120px;">現場</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${siteName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">報告日</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${reportDate}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">ステータス</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #22c55e; font-weight: bold;">承認済み</td>
          </tr>
        </table>
        <a href="${appUrl}/reports/${reportId}" style="display: inline-block; background: #22c55e; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 8px;">
          報告を確認する
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          このメールは${APP_NAME}から自動送信されています。
        </p>
      </div>
    `,
  });
}

// ---------------------------------------------------------------------------
// 差戻し時 → 報告者へ通知
// ---------------------------------------------------------------------------
export async function notifyReportRejected({
  siteName,
  reportDate,
  reportId,
  reporterEmail,
  rejectionReason,
}: {
  siteName: string;
  reportDate: string;
  reportId: string;
  reporterEmail: string;
  rejectionReason?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001";

  return sendEmail({
    to: reporterEmail,
    subject: `[${APP_NAME}] 報告差戻し: ${siteName} (${reportDate})`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1a1a1a; border-bottom: 2px solid #ef4444; padding-bottom: 8px;">
          報告が差し戻されました
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold; width: 120px;">現場</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${siteName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #f5f5f5; font-weight: bold;">報告日</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${reportDate}</td>
          </tr>
          ${
            rejectionReason
              ? `<tr>
            <td style="padding: 8px; border: 1px solid #ddd; background: #fef2f2; font-weight: bold; color: #ef4444;">差戻し理由</td>
            <td style="padding: 8px; border: 1px solid #ddd; color: #dc2626;">${rejectionReason}</td>
          </tr>`
              : ""
          }
        </table>
        <a href="${appUrl}/reports/${reportId}" style="display: inline-block; background: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 8px;">
          報告を修正する
        </a>
        <p style="color: #999; font-size: 12px; margin-top: 24px;">
          このメールは${APP_NAME}から自動送信されています。
        </p>
      </div>
    `,
  });
}
