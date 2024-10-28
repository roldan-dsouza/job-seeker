import {
  addOtpToCache,
  getOtpsForUser,
  verifyAndRemoveOtp,
} from "../config/cacheConfig.mjs";

export const saveOtp = (email, otp) => {
  addOtpToCache(email, otp);
};

export const getUserOtps = (email) => {
  return getOtpsForUser(email);
};

export const verifyotp = (email, otp) => {
  return verifyAndRemoveOtp(email, otp);
};
