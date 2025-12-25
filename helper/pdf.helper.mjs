export const validateFileType = (req, res, next) => {
  if (!req.file) return next();
  if (req.file.mimetype !== "application/pdf") {
    return res
      .status(400)
      .json({ error: "Invalid file format. Only PDF files are allowed!" });
  }
  next();
};
