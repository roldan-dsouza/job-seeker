import { body } from "express-validator";
import jwt from "jsonwebtoken";

export async function createAccessToken(user) {
  const accessKey = process.env.acessTokenKey;
  try {
    const payload = {
      userid: user._id,
      username: user.username,
    };

    const options = {
      expiresIn: "5h",
    };
    const accessToken = jwt.sign(payload, accessKey, options);
    console.log("Signed access JWT");
    return accessToken;
  } catch (error) {
    console.error("Error signing token:", error.message);
  }
}

export async function createRefreshToken(user) {
  const refreashKey = process.env.refreashTokenKey;
  try {
    const payload = {
      userid: user.__id,
      username: user.username,
    };
    const options = {
      expiresIn: "1d",
    };
    const refreashToken = jwt.sign(payload, refreashKey, options);
    return refreashToken;
  } catch (error) {
    console.log({ error: error.message });
  }
}

//example format of incoming header for vallidation
/*Authorization: Bearer abc123def456ghi789
refresh-token: xyz987lmn654opq321*/

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  let accessToken, refreshToken;

  // Check for Authorization header
  if (authHeader) {
    const parts = authHeader.split(" ");

    if (parts.length === 2 && parts[0] === "Bearer") {
      accessToken = parts[1];
    } else {
      return res
        .status(400)
        .json({ error: "Invalid Authorization header format" });
    }
  } else {
    return res.status(401).json({ error: "Authorization header missing" });
  }

  // Check for Refresh Token header
  const refreshTokenHeader = req.headers["refresh-token"];
  if (refreshTokenHeader) {
    refreshToken = Array.isArray(refreshTokenHeader)
      ? refreshTokenHeader[0]
      : refreshTokenHeader;
  } else {
    return res.status(401).json({ error: "Refresh token header missing" });
  }

  console.log({ accessToken, refreshToken });

  try {
    // Check for access token key in environment variables
    if (!process.env.acessTokenKey) {
      return res
        .status(500)
        .json({ error: "Internal server error: Missing access token key" });
    }

    // Verify access token
    const decoded = jwt.verify(accessToken, process.env.acessTokenKey);
    req.user = decoded;
    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      try {
        // Check for refresh token key in environment variables
        if (!process.env.refreashTokenKey) {
          return res.status(500).json({
            error: "Internal server error: Missing refresh token key",
          });
        }

        // Verify refresh token
        const decodedRefresh = jwt.verify(
          refreshToken,
          process.env.refreashTokenKey
        );
        const newAccessToken = createAccessToken(decodedRefresh);

        res.status(200).cookie("accesToken", newAccessToken); // Fixed the cookie setting
        return next();
      } catch (refreshError) {
        if (refreshError.name === "TokenExpiredError") {
          return res
            .status(401)
            .json({ error: "Refresh token expired, please log in again" });
        } else {
          return res.status(403).json({ error: "Invalid refresh token" });
        }
      }
    } else {
      return res.status(403).json({ error: error.message });
    }
  }
};
