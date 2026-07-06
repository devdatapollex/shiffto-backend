import jwt, { Secret } from "jsonwebtoken";
import httpStatus from "http-status";
import ApiError from "../errors/ApiError";

const generateToken = (
  payload: any,
  secret: Secret,
  expiresIn: string | number,
): string => {
  const token = jwt.sign(payload, secret, {
    algorithm: "HS256",
    expiresIn,
  } as jwt.SignOptions);
  return token;
};

const verifyToken = (token: string, secret: Secret) => {
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    return decoded;
  } catch {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid token");
  }
};

export const JwtHelper = {
  generateToken,
  verifyToken,
};
