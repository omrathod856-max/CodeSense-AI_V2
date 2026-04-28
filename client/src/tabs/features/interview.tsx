import { GridBackgroundDemo } from '@/components/ui/gridbackground';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import Navbar from './navbar';

type ConversationMessage = {
  id: string;
  speaker: 'Candidate' | 'Interviewer';
  text: string;
  isFinal: boolean;
  timestamp: string;
};

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function Interview({ imageUrl }: { imageUrl?: string }) {
  const location = useLocation();
  const username = location.state?.username || 'Candidate';
  const [isInterviewRunning, setIsInterviewRunning] = useState(false);
  const [statusText, setStatusText] = useState('Ready');
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const [socketStatus, setSocketStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [interviewReport, setInterviewReport] = useState<{
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
  } | null>(null);

  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any>(null);

  const socket: Socket = useMemo(() => io(BACKEND_URL, { 
    withCredentials: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  }), []);

  // Female TTS function
  const speak = useCallback((text: string) => {
    console.log('Attempting to speak:', text);
    if (!window.speechSynthesis) {
      console.error('Speech synthesis not supported in this browser.');
      return;
    }
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    
    const femaleVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('female') || 
      voice.name.toLowerCase().includes('google uk english female') ||
      voice.name.toLowerCase().includes('microsoft zira') ||
      voice.name.toLowerCase().includes('samantha') ||
      voice.name.toLowerCase().includes('victoria')
    );

    if (femaleVoice) {
      utterance.voice = femaleVoice;
    }
    
    utterance.pitch = 1.05;
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }, []);

  const upsertTranscript = useCallback((speaker: 'Candidate' | 'Interviewer', text: string, isFinal: boolean, timestamp?: string) => {
    if (!text.trim()) return;
    const msgTimestamp = timestamp || new Date().toISOString();

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.speaker === speaker && !last.isFinal) {
        const merged = [...prev];
        merged[merged.length - 1] = {
          ...last,
          text,
          isFinal,
          timestamp: msgTimestamp,
        };
        return merged;
      }

      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          speaker,
          text,
          isFinal,
          timestamp: msgTimestamp,
        },
      ];
    });
  }, []);

  useEffect(() => {
    if (socket.connected) setSocketStatus('connected');

    const onConnect = () => {
      console.log('Socket connected:', socket.id);
      setSocketStatus('connected');
      setError(null);
    };

    const onDisconnect = (reason: string) => {
      console.log('Socket disconnected:', reason);
      setSocketStatus('disconnected');
    };

    const onConnectError = (err: any) => {
      console.error('Socket connection error:', err);
      setSocketStatus('disconnected');
      setError(`Connection failed: ${err.message}`);
    };

    const onInterviewStatus = (payload: { status?: string }) => {
      console.log('Interview status update:', payload);
      setStatusText(payload.status || 'unknown');
      if (payload.status === 'active') {
        setIsInterviewRunning(true);
        setIsAiThinking(false);
        speak("Interview session is now live. I'm ready when you are.");
      } else if (payload.status === 'ended' || payload.status === 'abandoned') {
        setIsInterviewRunning(false);
        setIsAiThinking(false);
      }
    };

    const onTranscriptUpdate = (payload: { speaker: 'Candidate' | 'Interviewer'; text: string; isFinal?: boolean; timestamp?: string }) => {
      if (payload.speaker === 'Interviewer') {
        setIsAiThinking(false);
        speak(payload.text);
      }
      upsertTranscript(payload.speaker, payload.text, Boolean(payload.isFinal), payload.timestamp);
    };

    const onInterviewError = (payload: { message?: string }) => {
      setError(payload?.message || 'Unexpected interview error.');
      setIsAiThinking(false);
    };

    const onInterviewReport = (report: any) => {
      console.log('Received interview report:', report);
      setInterviewReport(report);
      speak(`Interview complete. Your knowledge score is ${report.score} out of 100.`);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('interview-status', onInterviewStatus);
    socket.on('transcript-update', onTranscriptUpdate);
    socket.on('interview-error', onInterviewError);
    socket.on('interview-report', onInterviewReport);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('interview-status', onInterviewStatus);
      socket.off('transcript-update', onTranscriptUpdate);
      socket.off('interview-error', onInterviewError);
      socket.off('interview-report', onInterviewReport);
    };
  }, [socket, speak, upsertTranscript]);

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTextInput(prev => (prev ? prev + ' ' + finalTranscript : finalTranscript));
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsMicActive(false);
      };

      recognitionRef.current.onend = () => setIsMicActive(false);
    }
  }, []);

  const toggleMic = () => {
    if (!recognitionRef.current) {
      setError('Speech recognition not supported in this browser.');
      return;
    }
    if (isMicActive) {
      recognitionRef.current.stop();
      setIsMicActive(false);
    } else {
      recognitionRef.current.start();
      setIsMicActive(true);
    }
  };

  const startInterview = async () => {
    setError(null);
    setMessages([]);
    setInterviewReport(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = mediaStream;
      socket.emit('start-interview', {
        candidateName: username,
        repoContext: location.state?.repoContext || '',
      });
      setIsInterviewRunning(true);
      setStatusText('Connecting...');
    } catch (err) {
      setError('Microphone access denied.');
    }
  };

  const stopInterview = () => {
    socket.emit('end-interview');
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsInterviewRunning(false);
    setStatusText('Ended');
  };

  const handleSendMessage = () => {
    if (!textInput.trim()) return;
    const userMsg = textInput.trim();
    setIsAiThinking(true);
    socket.emit('candidate-message', { text: userMsg });
    upsertTranscript('Candidate', userMsg, true, new Date().toISOString());
    setTextInput('');
    
    // Safety timeout
    setTimeout(() => setIsAiThinking(false), 15000);
  };

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const interviewerMessages = messages.filter(m => m.speaker === 'Interviewer');
  const isSpeaking = isAiThinking || isInterviewRunning;

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black overflow-hidden">
      <Navbar />
      <div className="flex-1 relative isolate overflow-y-auto bg-black min-h-0">
        <GridBackgroundDemo />
        <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 pt-24 pb-16 space-y-8 flex flex-col items-center">
          <div className="text-center space-y-4">
            <h1 className="text-white text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight">Interview Simulator</h1>
            <p className="text-neutral-400 text-sm max-w-lg mx-auto">Practice your technical skills with our AI interviewer.</p>
          </div>

          <div className="flex flex-wrap gap-4 items-center justify-center bg-neutral-900/50 border border-neutral-800 p-4 rounded-xl backdrop-blur-sm">
            <button 
              onClick={() => {
                console.log('Manual reconnect requested');
                socket.connect();
              }}
              className={`flex items-center gap-2 px-4 py-2 bg-neutral-950 border rounded-lg transition-all hover:bg-neutral-900 ${
                socketStatus === 'connected' ? 'border-green-500/20' : 'border-red-500/20'
              }`}
            >
              <div className={`h-2 w-2 rounded-full ${
                socketStatus === 'connected' ? 'bg-green-500' : 'bg-red-500 animate-pulse'
              }`}></div>
              <span className="text-[10px] uppercase font-bold text-neutral-400">
                {socketStatus === 'connected' ? 'Server Linked' : 'Server Offline (Click to Retry)'}
              </span>
            </button>

            {!isInterviewRunning ? (
              <Button onClick={startInterview} className="bg-white text-black hover:bg-neutral-200 font-bold px-8 h-10">Start Interview</Button>
            ) : (
              <Button onClick={stopInterview} variant="destructive" className="font-bold px-8 h-10">Stop Interview</Button>
            )}
            
            <div className="flex items-center gap-2 px-4 py-2 bg-neutral-950 border border-neutral-800 rounded-lg">
              <div className={`h-2 w-2 rounded-full ${isInterviewRunning ? 'bg-green-500 animate-pulse' : 'bg-neutral-600'}`}></div>
              <span className="text-sm font-medium text-neutral-300">{statusText}</span>
            </div>
          </div>

          {interviewReport && (
            <Card className="w-full max-w-4xl bg-blue-600/10 border-blue-500/30 p-8 backdrop-blur-md animate-in fade-in zoom-in duration-500">
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="relative flex items-center justify-center w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-neutral-800"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="58"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={364}
                      strokeDashoffset={364 - (364 * interviewReport.score) / 100}
                      className="text-blue-500 transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <span className="absolute text-3xl font-bold text-white">{interviewReport.score}%</span>
                </div>
                <div className="flex-1 space-y-4">
                  <h2 className="text-2xl font-bold text-white">Interview Performance Report</h2>
                  <p className="text-neutral-300 text-sm leading-relaxed">{interviewReport.feedback}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {interviewReport.strengths?.length > 0 && (
                      <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
                        <h4 className="text-green-400 text-xs font-bold uppercase mb-2">Strengths</h4>
                        <ul className="list-disc list-inside text-xs text-neutral-300 space-y-1">
                          {interviewReport.strengths.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                    )}
                    {interviewReport.weaknesses?.length > 0 && (
                      <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
                        <h4 className="text-red-400 text-xs font-bold uppercase mb-2">Areas to Improve</h4>
                        <ul className="list-disc list-inside text-xs text-neutral-300 space-y-1">
                          {interviewReport.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            <Card className="flex flex-col items-center justify-center p-8 bg-neutral-900/80 border-neutral-800 text-white backdrop-blur-sm">
              <div className="relative flex items-center justify-center w-28 h-28">
                {isAiThinking && <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping scale-110 z-0"></div>}
                <div className={`rounded-full p-1 border-2 ${isAiThinking ? 'border-blue-500' : 'border-neutral-700'}`}>
                  <img src="https://avatars.githubusercontent.com/u/9919?s=200&v=4" alt="AI" className="rounded-full w-24 h-24" />
                </div>
              </div>
              <h3 className="mt-6 text-xl font-semibold">AI Interviewer</h3>
              <div className="mt-4 w-full bg-neutral-950/50 rounded-lg p-4 h-24 flex items-center justify-center">
                <p className="text-sm text-neutral-400 italic text-center">
                  {interviewerMessages.length > 0 ? interviewerMessages[interviewerMessages.length - 1].text : 'Awaiting start...'}
                </p>
              </div>
            </Card>

            <Card className="flex flex-col items-center justify-center p-8 bg-neutral-900/80 border-neutral-800 text-white backdrop-blur-sm">
              <div className="rounded-full p-1 border-2 border-neutral-700">
                <img src={imageUrl || "https://avatars.githubusercontent.com/u/9919?s=200&v=4"} alt="Candidate" className="rounded-full w-24 h-24 object-cover" />
              </div>
              <h3 className="mt-6 text-xl font-semibold">{username}</h3>
              <p className="mt-4 text-sm text-neutral-400 text-center">Speak or type your answer below.</p>
            </Card>
          </div>

          <Card className="w-full bg-neutral-900/80 border-neutral-800 text-white p-6 backdrop-blur-sm">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-blue-500"></span> Live Transcript
            </h2>
            <div ref={transcriptContainerRef} className="h-80 overflow-y-auto space-y-4 pr-4 mb-6 custom-scrollbar">
              {messages.map((m) => (
                <div key={m.id} className={`rounded-xl border p-4 ${m.speaker === 'Interviewer' ? 'bg-blue-500/5 border-blue-500/20 mr-12' : 'bg-neutral-800/50 border-neutral-700 ml-12'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${m.speaker === 'Interviewer' ? 'bg-blue-500' : 'bg-neutral-700'}`}>{m.speaker}</span>
                    <span className="text-[10px] text-neutral-500">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <p className="text-sm leading-relaxed">{m.text}</p>
                </div>
              ))}
              {isAiThinking && (
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 mr-12 animate-pulse">
                  <span className="text-[10px] text-blue-400 italic">Interviewer is thinking...</span>
                </div>
              )}
            </div>

            <div className="flex gap-3 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
              <Button onClick={() => speak("Voice test active.")} className="h-10 w-10 p-0 rounded-lg bg-neutral-800 hover:bg-neutral-700">🔊</Button>
              <Button onClick={toggleMic} className={`h-10 w-10 p-0 rounded-lg ${isMicActive ? 'bg-red-500 animate-pulse' : 'bg-neutral-800'}`} disabled={!isInterviewRunning}>🎙️</Button>
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder={isInterviewRunning ? "Type or speak..." : "Start interview first..."}
                disabled={!isInterviewRunning}
                className="flex-1 bg-transparent px-4 py-2 text-sm focus:outline-none"
              />
              <Button onClick={handleSendMessage} className="bg-blue-600 hover:bg-blue-500 px-6 font-bold" disabled={!textInput.trim() || !isInterviewRunning}>Send</Button>
            </div>
            {error && <p className="mt-4 text-red-400 text-xs bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Interview;
