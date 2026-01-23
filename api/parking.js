import fs from "node:fs";
import path from "node:path";

export default function handler(req, res) {
  try {
    const dataPath = path.join(process.cwd(), "backend", "data", "parkings.json");
    const rawData = fs.readFileSync(dataPath, "utf8");
    const parkings = JSON.parse(rawData);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.status(200).json(parkings);
  } catch (err) {
    res.status(500).json({
      error: "Failed to load parking data",
      details: err?.message ?? String(err),
    });
  }
}


