import { afterEach, describe, expect, it, vi } from "vitest";

const mockCreateTransport = vi.hoisted(() => vi.fn());
const mockSendMail = vi.hoisted(() => vi.fn());

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

vi.mock("../../../src/config/index", () => ({
  default: {
    smtp: {
      service: "",
      host: "smtp.test.com",
      port: 587,
      user: "test@test.com",
      pass: "secret",
      from: "noreply@test.com",
    },
  },
}));

const { sendVerificationOTP } = await import("../../../src/app/lib/email");

describe("sendVerificationOTP", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("creates transporter once and reuses it on subsequent calls", async () => {
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    await sendVerificationOTP({
      email: "user@example.com",
      otp: "123456",
      type: "email-verification",
    });

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.test.com",
      port: 587,
      secure: false,
      auth: { user: "test@test.com", pass: "secret" },
    });

    expect(mockSendMail).toHaveBeenCalledWith({
      from: "noreply@test.com",
      to: "user@example.com",
      subject: "Verify your email for Shiffto",
      text: expect.stringContaining("123456"),
    });

    await sendVerificationOTP({
      email: "other@example.com",
      otp: "999999",
      type: "sign-in",
    });

    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
  });

  it("uses appropriate subject for sign-in type", async () => {
    mockCreateTransport.mockReturnValue({ sendMail: mockSendMail });

    await sendVerificationOTP({
      email: "user@example.com",
      otp: "654321",
      type: "sign-in",
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Sign in to Shiffto",
      }),
    );
  });

  it("uses appropriate subject for forget-password type", async () => {
    await sendVerificationOTP({
      email: "user@example.com",
      otp: "111111",
      type: "forget-password",
    });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reset your Shiffto password",
      }),
    );
  });

  it("falls back to SMTP_USER for from when SMTP_FROM is empty", async () => {
    vi.resetModules();
    mockCreateTransport.mockReset().mockReturnValue({ sendMail: mockSendMail });

    vi.doMock("../../../src/config/index", () => ({
      default: {
        smtp: {
          service: "",
          host: "smtp.test.com",
          port: 587,
          user: "test@test.com",
          pass: "secret",
          from: "",
        },
      },
    }));

    const { sendVerificationOTP: sendFn } =
      await import("../../../src/app/lib/email");

    await sendFn({ email: "u@e.com", otp: "555555", type: "sign-in" });

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "test@test.com",
      }),
    );
  });

  it("uses service config when SMTP_SERVICE is set", async () => {
    vi.resetModules();
    mockCreateTransport.mockReset().mockReturnValue({ sendMail: mockSendMail });

    vi.doMock("../../../src/config/index", () => ({
      default: {
        smtp: {
          service: "gmail",
          host: "",
          port: 587,
          user: "test@gmail.com",
          pass: "app-password",
          from: "test@gmail.com",
        },
      },
    }));

    const { sendVerificationOTP: sendFn } =
      await import("../../../src/app/lib/email");

    await sendFn({
      email: "u@e.com",
      otp: "123456",
      type: "email-verification",
    });

    expect(mockCreateTransport).toHaveBeenCalledWith({
      service: "gmail",
      auth: { user: "test@gmail.com", pass: "app-password" },
    });
  });
});
