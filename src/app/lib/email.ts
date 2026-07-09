import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";
import config from "../../config/index";

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
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}) => {
  const subject =
    type === "email-verification" || type === "change-email"
      ? "Verify your email for Shiffto"
      : type === "sign-in"
        ? "Sign in to Shiffto"
        : "Reset your Shiffto password";

  const from = config.smtp.from || config.smtp.user;

  const mailOptions: SendMailOptions = {
    from,
    to: email,
    subject,
    text: `Your verification code is: ${otp}\n\nThis code expires in 5 minutes.\n\nIf you didn't request this, please ignore this email.`,
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
