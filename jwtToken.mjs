import jwt from "jsonwebtoken";

export async function createAccessToken(user) {
  const accessKey = process.env.acessTokenKey;
  try {
    const payload = {
      userid: user.__id,
      username: user.username,
    };

    const options = {
      expiresIn: "5h",
    };
    const accessToken = jwt.sign(payload, accessKey, options);
    console.log("Signed JWT:", token);
    return accessToken;
  } catch (error) {
    console.error("Error signing token:", error.message);
  }
}

export async function createRefreashToken(user) {
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

const verifyToken = async (req, res) => {
  const authHeader = req.headers["authorization"];
  let accessToken, refreshToken;

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

  const refreshTokenHeader = req.headers["refresh-token"];
  if (refreshTokenHeader) {
    refreshToken = Array.isArray(refreshTokenHeader)
      ? refreshTokenHeader[0]
      : refreshTokenHeader;
  } else {
    return res.status(401).json({ error: "Refresh token header missing" });
  }

  console.log({ accessToken, refreshToken });
};
