const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pdf2img = require('pdf-img-convert');
const archiver = require('archiver');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.static('public'));

app.post('/convert', upload.single('pdf'), async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }

  const pdfPath = path.join(__dirname, file.path);
  const outputDir = path.join(__dirname, 'output', path.parse(file.filename).name);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    const config = {
      width: 1200, // Adjust width for higher quality
      height: 1600, // Adjust height for higher quality
      scale: 2.0 // Increase scale for higher resolution
    };

    const pdfArray = await pdf2img.convert(pdfPath, config);

    for (let i = 0; i < pdfArray.length; i++) {
      const imagePath = path.join(outputDir, `page_${i + 1}.jpg`);
      fs.writeFileSync(imagePath, Buffer.from(pdfArray[i]));
    }

    // Create a zip file
    const zipPath = path.join(outputDir, `${path.parse(file.filename).name}.zip`);
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Compression level
    });

    output.on('close', () => {
      // Send the zip file to the client
      res.download(zipPath, (err) => {
        if (err) {
          console.error('Error downloading the file:', err);
          res.status(500).send('An error occurred while downloading the file.');
        } else {
          // Clean up files and directories
          fs.unlinkSync(pdfPath);
          fs.unlinkSync(zipPath);
          setTimeout(() => {
            fs.rmSync(outputDir, { recursive: true, force: true });
          }, 1000); // Adding a delay to ensure the zip file is properly closed
        }
      });
    });

    archive.on('error', (err) => {
      throw err;
    });

    archive.pipe(output);
    archive.directory(outputDir, false);
    archive.finalize();

  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred while converting the PDF.');
    fs.unlinkSync(pdfPath);
    fs.rmSync(outputDir, { recursive: true, force: true });
  }
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});