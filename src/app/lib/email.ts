import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";
import config from "../../config/index";
import { renderTemplate } from "./email/template-engine";

let transporter: Transporter | null = null;

const getTransporter = () => {
  if (transporter) return transporter;

  const transportConfig = config.smtp.service
    ? {
        service: config.smtp.service,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      }
    : {
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465,
        auth: { user: config.smtp.user, pass: config.smtp.pass },
      };

  transporter = nodemailer.createTransport(transportConfig);
  return transporter;
};

export const verifyEmailTransport = async (): Promise<boolean> => {
  if (!config.smtp.user || !config.smtp.pass) {
    console.warn("SMTP credentials not configured. Email sending will fail.");
    return false;
  }

  try {
    await getTransporter().verify();
    console.log("SMTP connection verified successfully.");
    return true;
  } catch (error) {
    console.error("SMTP verification failed:", error);
    return false;
  }
};

export const sendVerificationOTP = async ({
  email,
  otp,
  type,
}: {
  email: string;
  otp: string;
  type:
    | "sign-in"
    | "email-verification"
    | "forget-password"
    | "change-email"
    | "shipment-verification"
    | "shipment-delivery";
}) => {
  const templateMap: Record<string, { template: string; subject: string }> = {
    "email-verification": {
      template: "auth/verify-email",
      subject: "Verify your email for Shiffto",
    },
    "change-email": {
      template: "auth/verify-email",
      subject: "Verify your new email for Shiffto",
    },
    "sign-in": {
      template: "auth/sign-in-otp",
      subject: "Sign in to Shiffto",
    },
    "forget-password": {
      template: "auth/forgot-password",
      subject: "Reset your Shiffto password",
    },
    "shipment-verification": {
      template: "notifications/shipment-verification",
      subject: "Confirm your shipment — Shiffto",
    },
    "shipment-delivery": {
      template: "notifications/shipment-verification",
      subject: "Confirm delivery — Shiffto",
    },
  };

  const mapping = templateMap[type];
  if (!mapping) {
    throw new Error(`Unknown email type: ${type}`);
  }
  const { template, subject } = mapping;
  const html = renderTemplate(template, { email, otp, subject });

  const from = config.smtp.from || config.smtp.user;

  const mailOptions: SendMailOptions = {
    from,
    to: email,
    subject,
    html,
  };
  try {
    await getTransporter().sendMail(mailOptions);
    console.log(
      `Verification email sent to ${email} (type: ${type}, OTP: ${otp})`,
    );
  } catch (error) {
    console.error(`Failed to send verification email to ${email}:`, error);
    throw error;
  }
};

export const sendEmail = async ({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) => {
  const from = config.smtp.from || config.smtp.user;
  const mailOptions: SendMailOptions = {
    from,
    to,
    subject,
    text,
    html,
  };
  try {
    await getTransporter().sendMail(mailOptions);
    console.log(`Email sent to ${to}: ${subject}`);
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error);
    throw error;
  }
};
