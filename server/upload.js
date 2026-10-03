const Busboy = require("busboy");
const fs = require("fs");
const ETLTransform = require("./etlTransform");

function uploadFile(req, res, io) {
  let rowsProcessed = 0;

  const busboy = Busboy({ headers: req.headers });

  busboy.on("file", (name, file, info) => {
    const save = fs.createWriteStream(`uploads/${info.filename}`);
    const transform = new ETLTransform();

    file.pipe(save);
    file.pipe(transform);

    transform.on("data", () => {
      rowsProcessed++;

      io.emit("job-status", {
        rowsProcessed
      });
      console.log("Rows processed:", rowsProcessed);
    });
  });

  busboy.on("finish", () => {
    res.json({ message: "Upload successful" });
  });

  req.pipe(busboy);
}

module.exports = uploadFile;