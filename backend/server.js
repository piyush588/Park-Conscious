import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";

const app = express();
app.use(cors());
app.use(express.json());

// serve parking data
app.get("/api/parking", (req, res) => {
  const dataPath = path.join(process.cwd(), "data", "parkings.json");
  const rawData = fs.readFileSync(dataPath);
  const parkings = JSON.parse(rawData);
  res.json(parkings);
});

// health check
app.get("/", (req, res) => res.send("✅ ParkFinder backend running!"));

const PORT = 5050;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
