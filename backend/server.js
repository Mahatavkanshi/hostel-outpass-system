const app = require('./app');
const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json()); // Parse JSON requests

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
