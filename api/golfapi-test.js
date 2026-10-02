const API_BASE = 'https://uk-golf-api.vercel.app';
const API_HOST = 'uk-golf-course-data-api.p.rapidapi.com';

async function golfApi(path) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) {
    const error = new Error('RAPIDAPI_KEY is not available to this deployment');
    error.status = 500;
    throw error;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'X-RapidAPI-Key': key,
      'X-RapidAPI-Host': API_HOST,
      Accept: 'application/json',
    },
  });

  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }

  if (!response.ok) {
    const error = new Error(`UK Golf API returned HTTP ${response.status}`);
    error.status = response.status;
    error.detail = data;
    throw error;
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'GET only' });

  try {
    const health = await golfApi('/');
    return res.status(200).json({
      ok: true,
      message: 'GGC can authenticate with UK Golf API.',
      provider: 'UK Golf API',
      health,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      ok: false,
      error: error.message,
      detail: error.detail || null,
    });
  }
}
