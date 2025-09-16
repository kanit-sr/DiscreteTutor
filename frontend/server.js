const express = require("express");

const app = express();

const path = require("path");
app.use(express.static(__dirname));

const PORT = process.env.FRONTEND_PORT || 3221;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Frontend Server ready at http://0.0.0.0:${PORT}`);
});
