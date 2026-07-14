import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../env';
import { isEmailVerificationEnabled } from '../lib/feature-flags';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }

  return transporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!isEmailVerificationEnabled()) {
    return;
  }

  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
  });
}

/** Test hook: reset cached transporter between tests. */
export function resetEmailTransporterForTests(): void {
  transporter = null;
}
