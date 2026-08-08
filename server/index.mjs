import { createApp } from './app.mjs';

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';
const { app } = await createApp();

app.listen(port, host, () => {
  console.log(`MindFlow API running at http://${host}:${port}`);
});
