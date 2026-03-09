interface SendMagicLinkOptions {
  to: string
  magicUrl: string
}

export interface EmailDeliveryResult {
  mode: "console" | "resend"
  messageId?: string
}

/**
 * Send a magic link email via Resend.
 * Falls back to console.log in development when RESEND_API_KEY is not set.
 */
export async function sendMagicLinkEmail({
  to,
  magicUrl,
}: SendMagicLinkOptions): Promise<EmailDeliveryResult> {
  const apiKey = process.env["RESEND_API_KEY"]

  if (!apiKey) {
    // Development fallback
    console.log(`\n[DEV] Magic link for ${to}:\n${magicUrl}\n`)
    return { mode: "console" }
  }

  const { Resend } = await import("resend")
  const resend = new Resend(apiKey)

  const result = await resend.emails.send({
    // Works out-of-the-box for testing on Resend free tier
    from: process.env["EMAIL_FROM"] ?? "onboarding@resend.dev",
    to,
    subject: "Your login link for API Contract",
    html: `
      <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #E6EDF3; margin-bottom: 16px;">Sign in to API Contract</h2>
        <p style="color: #8B949E; margin-bottom: 24px;">
          Click the button below to sign in. This link expires in 15 minutes.
        </p>
        <a
          href="${magicUrl}"
          style="
            display: inline-block;
            background: #7C6AF7;
            color: #ffffff;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
          "
        >
          Sign in to API Contract
        </a>
        <p style="color: #484F58; font-size: 12px; margin-top: 24px;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `,
  })

  if (result.error) {
    throw new Error(result.error.message)
  }

  if (!result.data?.id) {
    throw new Error("Email provider did not return a message id")
  }

  return {
    mode: "resend",
    messageId: result.data.id,
  }
}
