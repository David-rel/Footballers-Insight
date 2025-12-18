import sharp from 'sharp';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function makeCircular(inputPath, outputPath) {
  try {
    // Read the input image
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    const { width, height } = metadata;

    // Use the smaller dimension to make it a perfect circle
    const size = Math.min(width, height);

    // Create a circular mask
    const circleMask = Buffer.from(
      `<svg width="${size}" height="${size}">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
      </svg>`
    );

    // Resize to square, apply circular mask
    await image
      .resize(size, size, {
        fit: 'cover',
        position: 'center'
      })
      .composite([
        {
          input: circleMask,
          blend: 'dest-in'
        }
      ])
      .png()
      .toFile(outputPath);

    console.log(`✅ Successfully created circular icon: ${outputPath}`);
  } catch (error) {
    console.error('Error making circular image:', error);
    process.exit(1);
  }
}

// Make the dark icon circular
await makeCircular(
  join(projectRoot, 'public', 'icondark.png'),
  join(projectRoot, 'public', 'icondark-rounded.png')
);

console.log('✨ Done! Use icondark-rounded.png as your icon.');

