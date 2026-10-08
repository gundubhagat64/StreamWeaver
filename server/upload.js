const Busboy = require("busboy");
const fs = require("fs");
const ETLTransform = require("./etlTransform");

function uploadFile(req, res, io) {
  let rowsProcessed = 0;

  const busboy = Busboy({ headers: req.headers });

  // Handle file upload
  busboy.on("file", (name, file, info) => {
    const save = fs.createWriteStream(`uploads/${info.filename}`);
    const transform = new ETLTransform();

    file.pipe(save);
    file.pipe(transform);

    // Emit the number of rows processed to the client in real-time

    transform.on("data", () => {
      rowsProcessed++;

      io.emit("job-status", {
        rowsProcessed
      });
      console.log("Rows processed:", rowsProcessed);
    });
  });
  
// Handle errors during file upload
  busboy.on("error", (err) => {
    console.error("Error during file upload:", err);
    res.status(500).json({ error: "File upload failed" });
  });
   // Handle the end of the file upload
  busboy.on("finish", () => {
    res.json({ message: "Upload successful" });
  });

  req.pipe(busboy);
}

module.exports = uploadFile;