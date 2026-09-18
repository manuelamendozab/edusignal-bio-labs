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
  const qrsCount = Number(features.qrsCount || 0);

  try {
    // Umbrales en latidos por minuto segun las guias ACC/AHA/HRS: bradicardia
    // sinusal por debajo de 50 (guia de bradicardia 2018) y taquicardia sinusal
    // por encima de 100 (guia de taquicardia supraventricular 2015).
    const BRADYCARDIA_BPM = 50;
    const TACHYCARDIA_BPM = 100;
    // Evidencia minima (numero de complejos QRS) para estimar la frecuencia.
    const MIN_BEATS_FOR_RATE = 5;

    let prediction = 'Normal';
    let confidence = 0.72;
    let explanation = 'El patron observado es compatible con un ritmo sin senales claras de arritmia.';
    let status = 'normal';

    // Primero la puerta de calidad de senal. Un segmento con muy pocos latidos no
    // permite estimar la frecuencia: es un criterio de suficiencia de datos, no una
    // anomalia fisiologica, y por eso no se etiqueta como posible arritmia.
    if (qrsCount < MIN_BEATS_FOR_RATE) {
      prediction = 'No concluyente';
      confidence = 0;
      explanation =
        'El segmento contiene menos de ' + MIN_BEATS_FOR_RATE + ' complejos QRS detectados, ' +
        'insuficientes para estimar la frecuencia cardiaca. Indica un registro demasiado corto o ' +
        'de calidad limitada, no una anomalia fisiologica.';
      status = 'inconclusive';
    } else if (bpm > TACHYCARDIA_BPM || bpm < BRADYCARDIA_BPM) {
      prediction = 'Posible Arritmia';
      confidence = 0.84;
      explanation =
        'La frecuencia cardiaca estimada (' + bpm.toFixed(1) + ' BPM) queda fuera del rango de ' +
        BRADYCARDIA_BPM + '-' + TACHYCARDIA_BPM + ' BPM, lo que puede sugerir bradicardia o taquicardia.';
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
