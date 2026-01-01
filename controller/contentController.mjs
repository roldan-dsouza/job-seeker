import { content } from "../model/content.mjs";
import { generateContent } from "../utils/getContent.mjs";

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
    platform: platform,
    content: response.body.message,
    date: formattedTime,
    userId: id,
  });

  try {
    await newContent.save();
    console.log("Successfully saved in the database   ");
  } catch (err) {
    console.log(err.message);
    res.status(500).json("Failed to save in database");
  }

  const contentResponse = {
    userid: id,
    contentid: newContent._id,
    time: formattedTime,
    status: "draft",
    title: title,
    platform: platform,
    content: response.body.message,
  };
  res.status(202).json(contentResponse);
};

export const updateSavedContent = async (req, res) => {
  const id = req.user.userid;
  const preSave = req.body;
  try {
    await content.findOne({ _id: preSave.contentid });
  } catch (err) {
    return res.status(404).json({ error: "Content could not be found" });
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

  const data = {
    title: preSave.title,
    platform: preSave.platform,
    content: preSave.content,
    status: preSave.status,
    time: formattedTime,
  };
  try {
    const updatedData = await content.findOneAndUpdate(
      { _id: preSave.contentid },
      { $set: data },
      { new: true, runValidators: true }
    );
    return res
      .status(200)
      .json({ success: "true", updatedContent: updatedData });
  } catch (err) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteSavedContent = async (req, res) => {
  const id = req.user.userid;
  if (!id) return res.status(500).json({ error: "bypassed authentication" });
  const { contentid } = req.body;
  if (!contentid)
    return res.status(400).json({ error: "missing field contentid" });
  if (!(await content.findOne(contentid)))
    return res.status(404).json({ error: "content could not be found" });
  try {
    const deletedContent = await content.findByIdAndDelete({ _id: contentid });
    return res.status(200).json({
      success: true,
      message: "Successfully deleted from the database",
    });
  } catch (error) {
    return res.status(500).json({ error: "internal server error" });
  }
};

export const allContent = async (req, res) => {
  const id = req.user.userid;
  const availableContents = await content.find({ userId: id });
  return res.status(200).json({ availableContents });
};
