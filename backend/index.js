const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const cors = require('cors');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const port = process.env.PORT || 4000;
const dbPath = path.join(__dirname, 'database.sqlite');
const db = new Database(dbPath);
const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV || 'development' });
});

app.get('/users', (req, res) => {
  const rows = db.prepare('SELECT id, email, name, role, created_at FROM users').all();
  res.json(rows);
});

app.post('/users', (req, res) => {
  const { email, name, role = 'student' } = req.body;
  if (!email || !name) {
    return res.status(400).json({ error: 'email and name are required' });
  }

  try {
    const stmt = db.prepare('INSERT INTO users (email, name, role) VALUES (?, ?, ?)');
    const result = stmt.run(email, name, role);
    const user = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(user);
  } catch (error) {
    if (error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'email already exists' });
    }
    console.error(error);
    res.status(500).json({ error: 'internal server error' });
  }
});

app.get('/labs', (req, res) => {
  const rows = db.prepare('SELECT id, title, description, created_at, updated_at FROM labs').all();
  res.json(rows);
});

app.post('/labs', (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  try {
    const stmt = db.prepare('INSERT INTO labs (title, description) VALUES (?, ?)');
    const result = stmt.run(title, description || null);
    const lab = db.prepare('SELECT id, title, description, created_at, updated_at FROM labs WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(lab);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'internal server error' });
  }
});

app.post('/api/ecg/intelligent-analysis', async (req, res) => {
  const { features } = req.body || {};

  if (!features || typeof features !== 'object') {
    return res.status(400).json({ error: 'features are required' });
  }

  const bpm = Number(features.bpm || 0);
  const hrv = Number(features.hrv || 0);
  const qrsCount = Number(features.qrsCount || 0);

  try {
    let prediction = 'Normal';
    let confidence = 0.72;
    let explanation = 'El patrón observado es compatible con un ritmo sin señales claras de arritmia.';
    let status = 'normal';

    if (bpm > 100 || bpm < 50) {
      prediction = 'Posible Arritmia';
      confidence = 0.84;
      explanation = 'La frecuencia cardíaca se encuentra fuera del rango habitual, lo que puede sugerir taquicardia o bradicardia.';
      status = 'warning';
    } else if (hrv < 40 || qrsCount < 5) {
      prediction = 'Posible Arritmia';
      confidence = 0.79;
      explanation = 'La variabilidad y la detección de complejos QRS sugieren una señal menos estable o con calidad limitada.';
      status = 'warning';
    }

    res.json({
      prediction,
      confidence,
      explanation,
      status,
      model: 'rule-based-prototype',
      backend: 'node-express',
      readyForModel: 'TensorFlow or Scikit-Learn can be plugged in here',
    });
  } catch (error) {
    console.error('ECG intelligent analysis error:', error);
    res.status(500).json({ error: 'Failed to process ECG intelligent analysis' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'question is required' });
  }

  try {
    const systemPrompt = `Eres un asistente inteligente para EduSignal, una plataforma educativa para aprender procesamiento digital de señales fisiológicas (ECG, EMG, EEG). 
    Tu rol es responder preguntas sobre el sistema, conceptos de bioseñales y ayudar a los usuarios.
    Proporciona respuestas claras, educativas y en español cuando sea necesario.`;

    const message = await client.messages.create({
      model: 'claude-opus-4-1',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: question,
        },
      ],
    });

    const responseText = message.content[0]?.text || 'No se pudo generar respuesta';
    res.json({ answer: responseText });
  } catch (error) {
    console.error('Claude API error:', error);
    res.status(500).json({ error: 'Failed to process question with Claude' });
  }
});



app.listen(port, () => {
  console.log(`Backend server listening on http://0.0.0.0:${port}`);
});
