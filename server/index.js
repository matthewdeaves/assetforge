const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3777;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

const projectRoutes = require('./routes/projects');
const spriteRoutes = require('./routes/sprites');
const exportRoutes = require('./routes/export');
const evalRoutes = require('./routes/eval');
app.use('/api', projectRoutes);
app.use('/api', spriteRoutes);
app.use('/api', exportRoutes);
app.use('/api', evalRoutes);

app.listen(PORT, () => {
  console.log(`Asset Forge running on http://localhost:${PORT}`);
});

module.exports = app;
