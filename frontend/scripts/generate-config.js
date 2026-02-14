import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read API key from environment variable
// In Vercel, this will come from Project Settings
// Locally, you can set it in terminal: export GOOGLE_MAPS_API_KEY=...
const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';

const configContent = `window.PARK_CONFIG = {
    MAPS_KEY: "${apiKey}"
};`;

const outputPath = path.join(__dirname, 'config.js');

try {
    fs.writeFileSync(outputPath, configContent);
    console.log('✅ Generated frontend/scripts/config.js');
} catch (err) {
    console.error('❌ Failed to generate config.js:', err);
    process.exit(1);
}
