import { User } from "../model/user.mjs";
import { content } from "../model/content.mjs";
import { generateContent } from "../functions/getContent.mjs";

export const getContent = async (req, res) => {
  const id = req.user.userid;
  const { platform } = req.body;

  if (!id || !platform) {
    return res.status(400).json({ error: "missing fields" });
  }
  const platforms = ["email", "linkdn", "coverLetter", "instagram"];
  if (!platforms.includes(platform)) {
    return res.status(400).json({ error: "Invalid platform" });
  }
  const response = await generateContent(platform, id);

  if (response.success == false && response.message == "noUser") {
    return res.status(404).json({ error: "User does not exist" });
  }
  if (response.success == false && response.message == "noPdf") {
    return res.status(400).json({ error: "User hasnt uploaded the resume" });
  }

  const now = new Date();
  const formattedTime = now.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  let title;
  if (platform == "linkdn") {
    title = "new linkdn post";
  }

  if (platform == "instagram") {
    title = "new instagram post";
  }

  if (platform == "email") {
    title = "new email";
  }

  if (platform == "coverLetter") {
    title = "new cover letter";
  }

  const newContent = new content({
    title: title,
    type: platform,
    content: response.body.message || response.body.messageBody,
    date: formattedTime,
  });

  try {
    await newContent.save();
    console.log("Successfully saved in the database   ");
    await User.findOneAndUpdate(
      { _id: id },
      { contentId: newContent._id },
      { new: true }
    );
  } catch (err) {
    console.log(err.message);
    res.status(500).json("Failed to save in database");
  }

  const contentResponse = {
    id: id,
    time: formattedTime,
    status: "draft",
    title: title,
    platform: platform,
    content: response.body.message,
  };
  res.status(202).json(contentResponse);
};

export const updateSavedConstant = async (req, res) => {};
