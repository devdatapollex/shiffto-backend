import { randomInt, timingSafeEqual } from "crypto";
import { generateId } from "@better-auth/core/utils/id";
import prisma from "../../lib/prisma";
import { Prisma } from "../../../generated/prisma/client";
import ApiError from "../../errors/ApiError";
import { sendVerificationOTP } from "../../lib/email";

const OTP_IDENTIFIER_PREFIX = "shipment-verification-otp";
const OTP_EXPIRY_SECONDS = 300;
const OTP_MAX_ATTEMPTS = 3;
const OTP_LENGTH = 6;

type VerificationClient = Prisma.TransactionClient | typeof prisma;

const buildIdentifier = (email: string) =>
  `${OTP_IDENTIFIER_PREFIX}-${email.toLowerCase()}`;

const generateOtpCode = (): string => {
  const min = 0;
  const max = 10 ** OTP_LENGTH;
  return String(randomInt(min, max)).padStart(OTP_LENGTH, "0");
};

const splitValue = (value: string): [string, string] => {
  const idx = value.lastIndexOf(":");
  if (idx === -1) return [value, ""];
  return [value.slice(0, idx), value.slice(idx + 1)];
};

const constantTimeEquals = (a: string, b: string): boolean => {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
};

const generateAndSendShipmentOtp = async (email: string): Promise<void> => {
  const identifier = buildIdentifier(email);
  const otp = generateOtpCode();

  await prisma.verification.deleteMany({ where: { identifier } });
  await prisma.verification.create({
    data: {
      id: generateId(24),
      identifier,
      value: `${otp}:0`,
      expiresAt: new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000),
    },
  });

  await sendVerificationOTP({
    email,
    otp,
    type: "shipment-verification",
  });
};

const verifyShipmentOtp = async (
  email: string,
  otp: string,
  client: VerificationClient = prisma,
): Promise<void> => {
  const identifier = buildIdentifier(email);
  const record = await client.verification.findFirst({ where: { identifier } });

  if (!record) {
    throw new ApiError(400, "Invalid OTP");
  }

  if (record.expiresAt < new Date()) {
    await client.verification.deleteMany({ where: { identifier } });
    throw new ApiError(400, "OTP expired");
  }

  const [storedOtp, attemptsRaw] = splitValue(record.value);
  const attempts = parseInt(attemptsRaw || "0", 10);

  if (attempts >= OTP_MAX_ATTEMPTS) {
    await client.verification.deleteMany({ where: { identifier } });
    throw new ApiError(403, "Too many attempts. Please request a new code.");
  }

  if (!constantTimeEquals(storedOtp, otp)) {
    await client.verification.update({
      where: { id: record.id },
      data: { value: `${storedOtp}:${attempts + 1}` },
    });
    throw new ApiError(400, "Invalid OTP");
  }

  await client.verification.delete({ where: { id: record.id } });
};

export const ShipmentOtpService = {
  generateAndSendShipmentOtp,
  verifyShipmentOtp,
};
