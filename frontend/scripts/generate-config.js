const fs = require('fs');
const path = require('path');

// Read API key from environment variable
// In Vercel, this will come from Project Settings
// Locally, you can set it in terminal: export GOOGLE_MAPS_API_KEY=...
const apiKey = process.env.GOOGLE_MAPS_API_KEY || '';
// NOTE: I've kept your original key as a fallback for local dev convenience, 
// but you should ideally remove it even from here once you have it in your local env.

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
