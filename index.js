const express = require('express');
const multer = require('multer');
const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const pdf = require('pdf-poppler');
const archiver = require('archiver');
const app = express();
const port = 3000;

const upload = multer({ dest: 'uploads/' });

async function convertPdfToJpg(pdfPath, outputDir) {
  try {
    await fs.ensureDir(outputDir);

    const options = {
      format: 'png',
      out_dir: outputDir,
      out_prefix: path.basename(pdfPath, path.extname(pdfPath)),
      page: null
    };

    // Convert PDF to PNG using pdf-poppler
    await pdf.convert(pdfPath, options);

    // Get the list of PNG files generated
    const files = await fs.readdir(outputDir);
    const pngFiles = files.filter(file => file.endsWith('.png'));

    const jpgFiles = [];

    // Convert each PNG to JPG using sharp
    for (const pngFile of pngFiles) {
      const inputFilePath = path.join(outputDir, pngFile);
      const outputFilePath = path.join(outputDir, `${path.basename(pngFile, '.png')}.jpg`);
      
      const jpgBuffer = await sharp(inputFilePath)
        .jpeg({ quality: 80 })
        .toBuffer();

      await fs.writeFile(outputFilePath, jpgBuffer);
      await fs.remove(inputFilePath); // Remove the intermediate PNG file

    //   console.log(`Converted ${pngFile} to JPG and saved to ${outputFilePath}`);
      jpgFiles.push(outputFilePath);
    }

    console.log('PDF successfully converted to JPG.');
    return jpgFiles;
  } catch (error) {
    console.error('Error converting PDF to JPG:', error);
    throw error;
  }
}

app.post('/convert', upload.single('pdf'), async (req, res) => {
  const pdfPath = req.file.path;
  const outputDir = path.join(__dirname, 'output', path.basename(pdfPath, path.extname(pdfPath)));

  try {
    const jpgFiles = await convertPdfToJpg(pdfPath, outputDir);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=converted-images.zip');

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (const file of jpgFiles) {
      archive.file(file, { name: path.basename(file) });
    }

    archive.finalize();

    // Cleanup: Delete files and folder after sending
    archive.on('end', async () => {
      for (const file of jpgFiles) {
        await fs.remove(file);
      }
      await fs.remove(outputDir);
      await fs.remove(pdfPath);
    });

  } catch (error) {
    res.status(500).json({ error: 'Error converting PDF to JPG.', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
