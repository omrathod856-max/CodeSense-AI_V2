const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const WebSocket = require('ws');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const VoiceInterviewSession = require('./models/voiceInterview');
const { callLLM } = require('./utils/llm');


dotenv.config();

//Importing routes
const authRoutes = require('./routes/auth.routes');
const interviewRoutes = require('./routes/interview.routes');

const app = express();
const PORT = process.env.PORT;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const REMOTE_VOICE_WS_URL = process.env.REMOTE_VOICE_WS_URL || '';
const REMOTE_AUTH_TOKEN = process.env.REMOTE_AUTH_TOKEN || '';

const relayState = new Map();

function getNgrokHeaders() {
  const headers = {
    'ngrok-skip-browser-warning': 'true',
  };

  if (REMOTE_AUTH_TOKEN) {
    headers.Authorization = `Bearer ${REMOTE_AUTH_TOKEN}`;
  }

  return headers;
}

function toBuffer(payload) {
  if (!payload) return null;

  if (Buffer.isBuffer(payload)) {
    return payload;
  }

  if (payload instanceof ArrayBuffer) {
    return Buffer.from(payload);
  }

  if (ArrayBuffer.isView(payload)) {
    return Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
  }

  if (typeof payload === 'string') {
    try {
      return Buffer.from(payload, 'base64');
    } catch {
      return null;
    }
  }

  return null;
}

async function appendTurn(sessionId, speaker, text) {
  if (!sessionId || !text || !text.trim()) return;

  await VoiceInterviewSession.findByIdAndUpdate(sessionId, {
    $push: {
      turns: {
        speaker,
        text: text.trim(),
      },
    },
  });
}

async function closeRelay(socketId, status = 'ended') {
  const state = relayState.get(socketId);
  if (!state) return;

  if (state.remoteWs && state.remoteWs.readyState === WebSocket.OPEN) {
    state.remoteWs.close();
  }

  if (state.sessionId) {
    await VoiceInterviewSession.findByIdAndUpdate(state.sessionId, {
      status,
      endedAt: new Date(),
    }).catch(() => {});
  }

  relayState.delete(socketId);
}

app.use(cookieParser());
app.use(cors({
    origin: FRONTEND_ORIGIN,
    credentials: true,
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// Optional fallback for debugging uploads. Streaming through Socket.io is preferred.
app.post('/interview/upload-chunk', upload.single('audio'), (req, res) => {
  const size = req.file?.buffer?.length || 0;
  return res.status(200).json({
    success: true,
    bytesReceived: size,
    mimeType: req.file?.mimetype || null,
  });
});

app.use('/auth', authRoutes);
app.use('/interview', interviewRoutes);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  },
  maxHttpBufferSize: 10 * 1024 * 1024,
});

io.use((socket, next) => {
  const cookieString = socket.handshake.headers.cookie;
  console.log('Socket handshake cookies:', cookieString);
  
  if (!cookieString) {
    console.log('No cookies in handshake');
    return next(new Error('Authentication error: No cookies'));
  }

  const token = cookieString
    .split(';')
    .find((c) => c.trim().startsWith('token='))
    ?.split('=')[1];

  if (!token) {
    console.log('No token found in cookies');
    return next(new Error('Authentication error: No token'));
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.log('JWT verification failed:', err.message);
      return next(new Error('Authentication error: Invalid token'));
    }
    socket.user = decoded;
    console.log('Socket authenticated for user:', decoded.id);
    next();
  });
});

io.on('connection', (socket) => {
  console.log('New socket connection established:', socket.id);
  
  socket.emit('interview-status', {
    status: 'connected',
    socketId: socket.id,
  });

  socket.onAny((eventName, ...args) => {
    console.log(`[Socket Event] ${eventName}:`, JSON.stringify(args).slice(0, 100));
  });

  socket.on('start-interview', async (payload = {}) => {
    console.log('Received start-interview:', payload);
    console.log('Socket user info:', socket.user);
    try {
      const session = await VoiceInterviewSession.create({
        userId: socket.user?.id || socket.user?._id || null,
        socketId: socket.id,
        candidateName: payload.candidateName || 'Candidate',
        repoUrl: payload.repoUrl || '',
        status: 'active',
        metadata: {
          role: payload.role || 'Software Engineer',
          difficulty: payload.difficulty || 'medium',
          language: payload.language || 'mixed',
        },
      });

      console.log('VoiceInterviewSession created:', session._id);

      relayState.set(socket.id, {
        remoteWs: null,
        sessionId: session._id,
        isMock: true,
        transcriptBuffer: '',
        repoContext: payload.repoContext || '',
        history: [], // Conversation history for local LLM
      });

      socket.emit('interview-status', {
        status: 'active',
        sessionId: session._id,
        mode: 'text-only',
      });

      // Send a welcome message
      const welcome = "Hello! I'm your AI interviewer. I've analyzed your repository and I'm ready to start. How are you doing today?";
      socket.emit('transcript-update', {
        speaker: 'Interviewer',
        text: welcome,
        isFinal: true,
        timestamp: new Date().toISOString(),
      });
      await appendTurn(session._id, 'Interviewer', welcome);

    } catch (error) {
      console.error('Interview start failed:', error);
      socket.emit('interview-error', {
        message: `Interview start failed: ${error.message}`,
      });
    }
  });

  socket.on('candidate-message', async (payload = {}) => {
    console.log('Received candidate-message from', socket.id, ':', payload);
    let state = relayState.get(socket.id);
    const candidateText = payload.text;
    
    if (!candidateText) return;

    try {
      // If state is missing (e.g. server restart or refresh), create a minimal mock state
      if (!state) {
        console.log('No state found for socket, creating mock state.');
        state = {
          isMock: true,
          repoContext: '',
          sessionId: null,
          history: []
        };
        relayState.set(socket.id, state);
      }

      if (state.sessionId) {
        await appendTurn(state.sessionId, 'Candidate', candidateText);
      }

      state.history = state.history || [];
      state.history.push({ role: 'user', content: candidateText });

      console.log('Generating AI response...');
      
      let response;
      const normalizedText = candidateText.toLowerCase();
      
      // SUPER AGGRESSIVE check for ready/hello to bypass LLM latency
      if (normalizedText.includes('ready') || normalizedText.includes('hello') || normalizedText.includes('hi ') || normalizedText.includes('interview')) {
        console.log('Using instant response for initial message.');
        response = "Excellent! I've analyzed your repository. To get started, can you give me a high-level overview of the project's architecture and the main technologies you used?";
      } else {
        console.log('Calling local LLM...');
        const systemPrompt = [
          'You are a technical interviewer conducting a live interview based on the provided source code.',
          '1. ACKNOWLEDGE the candidate last answer directly.',
          '2. Ask ONE specific technical question about the repository.',
          '3. Keep it short (2 sentences max).',
          state.repoContext ? `\n\nCONTEXT:\n${state.repoContext.slice(0, 4000)}` : ''
        ].join('\n');

        const messages = [
          { role: 'system', content: systemPrompt },
          ...state.history.slice(-4)
        ];

        response = await callLLM(messages, { temperature: 0.7 });
      }

      if (!response) response = "I see. Could you tell me more about how you structured your components?";

      console.log('Sending response to client:', response);

      socket.emit('transcript-update', {
        speaker: 'Interviewer',
        text: response,
        isFinal: true,
        timestamp: new Date().toISOString(),
      });

      if (state.sessionId) {
        await appendTurn(state.sessionId, 'Interviewer', response);
      }
      state.history.push({ role: 'assistant', content: response });

    } catch (error) {
      console.error('AI response failed:', error);
      socket.emit('interview-error', { message: 'The AI took too long to respond. Please try again.' });
    }
  });

  socket.on('audio-chunk', (payload = {}) => {
    // Audio processing ignored in mock mode
  });

  socket.on('end-interview', async () => {
    console.log('Received end-interview for socket:', socket.id);
    const state = relayState.get(socket.id);
    
    if (state && state.history && state.history.length > 2) {
        try {
            console.log('Generating interview score and feedback...');
            const evaluationPrompt = [
                'You are a senior technical evaluator.',
                'Analyze the following interview transcript and the repository context.',
                'Provide a knowledge score out of 100 and a brief summary of strengths and areas for improvement.',
                'Format the response as a JSON object: {"score": number, "feedback": "string", "strengths": ["string"], "weaknesses": ["string"]}',
                `\n\nTRANSCRIPT:\n${state.history.map(h => `${h.role}: ${h.content}`).join('\n')}`,
                state.repoContext ? `\n\nREPOSITORY CONTEXT:\n${state.repoContext.slice(0, 3000)}` : ''
            ].join('\n');

            const evaluation = await callLLM([{ role: 'system', content: evaluationPrompt }], { temperature: 0.3 });
            let parsedEval;
            try {
                parsedEval = JSON.parse(evaluation.match(/\{[\s\S]*\}/)[0]);
            } catch {
                parsedEval = { score: 70, feedback: evaluation, strengths: [], weaknesses: [] };
            }

            // Persist evaluation to database
            if (state.sessionId) {
              await VoiceInterviewSession.findByIdAndUpdate(state.sessionId, {
                evaluation: parsedEval,
                status: 'ended',
                endedAt: new Date()
              }).catch(e => console.error('Failed to save evaluation to DB:', e));
            }

            socket.emit('interview-report', parsedEval);
        } catch (error) {
            console.error('Evaluation failed:', error);
        }
    }

    await closeRelay(socket.id, 'ended');
    socket.emit('interview-status', { status: 'ended' });
  });

  socket.on('disconnect', async () => {
    console.log('Socket disconnected:', socket.id);
    await closeRelay(socket.id, 'abandoned');
  });
});

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
