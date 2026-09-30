const Busboy = require("busboy");
const fs = require("fs");

function uploadFile(req, res) {
  const busboy = Busboy({ headers: req.headers });

  busboy.on("file", (name, file, info) => {
    const save = fs.createWriteStream(`uploads/${info.filename}`);
    file.pipe(save);
  });

  busboy.on("finish", () => {
    res.json({ message: "Upload successful" });
  });

  req.pipe(busboy);
}

module.exports = uploadFile;