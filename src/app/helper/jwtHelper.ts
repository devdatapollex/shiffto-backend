import jwt, { Secret } from 'jsonwebtoken';
import ApiError from '../errors/ApiError';
import httpStatus from 'http-status';

const generateToken = (payload: any, secret: Secret, expiresIn: string | number): string => {
    const token = jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn } as jwt.SignOptions);
    return token;
}


const verifyToken = (token: string, secret: Secret) => {
    try {
        const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
        return decoded;
    } catch (error) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token');
    }
};

export const JwtHelper = {
    generateToken,
    verifyToken,
};