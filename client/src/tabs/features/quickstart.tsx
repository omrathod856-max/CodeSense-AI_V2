import { GridBackgroundDemo } from '@/components/ui/gridbackground';
import Navbar from './navbar';
import { IconBrandGithub, IconArrowRight, IconLoader2, IconBriefcase, IconCode, IconHelp, IconBulb, IconHistory, IconChevronLeft, IconTrash } from '@tabler/icons-react';
import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const LAST_INTERVIEW_KEY = 'codesense_last_interview';

interface Question {
  type: string;
  question: string;
  expected_points: string[];
  difficulty: string;
}

interface InterviewData {
  _id?: string;
  summary: string;
  questions: Question[];
  hands_on_task: {
    prompt: string;
    evaluation_rubric: string[];
  };
  follow_ups: string[];
  repoUrl?: string;
  timestamp?: number;
  createdAt?: string;
}

function normalizeInterviewData(raw: any, repoUrl: string): InterviewData {
  return {
    summary: typeof raw?.summary === 'string' ? raw.summary : 'No summary available.',
    questions: Array.isArray(raw?.questions) ? raw.questions : [],
    hands_on_task: {
      prompt: typeof raw?.hands_on_task?.prompt === 'string' ? raw.hands_on_task.prompt : 'No coding task available.',
      evaluation_rubric: Array.isArray(raw?.hands_on_task?.evaluation_rubric)
        ? raw.hands_on_task.evaluation_rubric
        : [],
    },
    follow_ups: Array.isArray(raw?.follow_ups) ? raw.follow_ups : [],
    repoUrl,
    timestamp: Date.now(),
  };
}

function sanitizeBackendError(message?: string, details?: string) {
  const combined = [message, details].filter(Boolean).join(': ');
  if (!combined) return 'An error occurred while analyzing the repository';

  // Avoid dumping HTML error pages into the UI.
  if (combined.includes('<!DOCTYPE html') || combined.includes('<html')) {
    return 'Server returned an invalid response. Please check backend logs and request format.';
  }

  return combined;
}

function Quickstart() {
  const location = useLocation();
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [recentInterview, setRecentInterview] = useState<InterviewData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LAST_INTERVIEW_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setRecentInterview(parsed);
      } catch (e) {
        localStorage.removeItem(LAST_INTERVIEW_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const selected = (location.state as { interview?: InterviewData } | null)?.interview;
    if (selected) {
      setInterviewData(selected);
      setRecentInterview(selected);
      if (selected.repoUrl) {
        setRepoUrl(selected.repoUrl);
      }
      localStorage.setItem(LAST_INTERVIEW_KEY, JSON.stringify(selected));
    }
  }, [location.state]);

  useEffect(() => {
    const loadLatestFromDb = async () => {
      try {
        const response = await axios.get('http://localhost:3000/interview/recent?limit=1', {
          withCredentials: true,
        });
        const latest = response.data?.data?.[0];
        if (latest) {
          const normalized = normalizeInterviewData(latest, latest.repoUrl || '');
          normalized._id = latest._id;
          normalized.createdAt = latest.createdAt;
          normalized.timestamp = latest.createdAt ? new Date(latest.createdAt).getTime() : Date.now();
          setRecentInterview(normalized);
          localStorage.setItem(LAST_INTERVIEW_KEY, JSON.stringify(normalized));
        }
      } catch {
        // Keep local fallback if API is unavailable.
      }
    };

    loadLatestFromDb();
  }, []);

  const handleAnalyze = async (urlToUse?: string) => {
    const finalUrl = urlToUse || repoUrl;
    if (!finalUrl.trim()) return;

    setLoading(true);
    setError(null);
    setInterviewData(null);

    try {
      const response = await axios.post('http://localhost:3000/interview/generate', { repoUrl: finalUrl }, {
        withCredentials: true
      });
      
      if (response.data.success) {
        const newData = normalizeInterviewData(response.data.data, finalUrl);
        newData._id = response.data.data?._id;
        newData.createdAt = response.data.data?.createdAt;
        newData.timestamp = response.data.data?.createdAt
          ? new Date(response.data.data.createdAt).getTime()
          : Date.now();
        setInterviewData(newData);
        setRecentInterview(newData);
        localStorage.setItem(LAST_INTERVIEW_KEY, JSON.stringify(newData));
      } else {
        setError(response.data.message || 'Failed to generate interview');
      }
    } catch (err: any) {
      console.error('Error analyzing repo:', err);
      const backendMessage = err.response?.data?.message;
      const backendError = err.response?.data?.error;
      setError(sanitizeBackendError(backendMessage, backendError));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    axios.delete('http://localhost:3000/interview', { withCredentials: true })
      .finally(() => {
        localStorage.removeItem(LAST_INTERVIEW_KEY);
        setRecentInterview(null);
      });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'hard': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30';
    }
  };

  const renderAnalyzeBox = (compact = false) => (
    <div className={`w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-700 rounded-xl shadow-xl ${compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6'}`}>
      <div className="flex items-center gap-2 mb-3">
        <IconBrandGithub className="h-5 w-5 text-white" />
        <h3 className={`text-white font-semibold ${compact ? 'text-base' : 'text-lg'}`}>Analyze GitHub Repository</h3>
      </div>
      {!compact && (
        <p className="text-neutral-400 text-sm mb-4">
          Paste your GitHub repository link to generate AI-powered interview questions and code analysis.
        </p>
      )}
      <div className="flex flex-col lg:flex-row gap-3">
        <Input
          type="url"
          placeholder="https://github.com/username/repository"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className="flex-1 bg-neutral-800 border-neutral-600 text-white placeholder:text-neutral-500 focus:border-neutral-500"
        />
        <Button
          onClick={() => handleAnalyze()}
          disabled={loading}
          className="bg-white text-black hover:bg-neutral-200 font-semibold px-6 disabled:opacity-50 lg:min-w-37.5"
        >
          {loading ? (
            <>
              <IconLoader2 className="h-4 w-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              Analyze
              <IconArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
      {error && (
        <p className="text-red-400 text-xs mt-3 bg-red-400/10 p-2 rounded border border-red-400/20 wrap-break-word max-h-28 overflow-y-auto">
          {error}
        </p>
      )}
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black overflow-hidden">
      <Navbar />
      <div className="flex-1 relative isolate overflow-y-auto bg-black min-h-0">
        <GridBackgroundDemo />
        
        {/* GitHub Repo Link Input Card or Results Header */}
        {!interviewData && (
          <div className="relative z-10 flex flex-col items-center pt-24 sm:pt-32 md:pt-40 px-4 sm:px-8 space-y-8 max-w-5xl mx-auto w-full">
            {renderAnalyzeBox(false)}

            {/* Recent Analysis Card */}
            {recentInterview && (
              <div className="w-full animate-in fade-in slide-in-from-bottom-3 duration-500">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2 text-neutral-400">
                    <IconHistory className="h-4 w-4" />
                    <span className="text-sm font-medium uppercase tracking-wider">Recent Activity</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    onClick={clearHistory}
                    className="text-neutral-500 hover:text-red-400 h-8 px-2 text-xs hover:bg-transparent"
                  >
                    <IconTrash className="h-3 w-3 mr-1" />
                    Clear History
                  </Button>
                </div>
                <Card 
                  onClick={() => setInterviewData(recentInterview)}
                  className="group cursor-pointer bg-neutral-900/40 border-neutral-800 hover:border-neutral-600 transition-all p-5 flex items-center justify-between rounded-xl shadow-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-blue-500/10 p-3 rounded-lg group-hover:bg-blue-500/20 transition-colors">
                      <IconBriefcase className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-medium group-hover:text-blue-400 transition-colors line-clamp-1">
                        {recentInterview.repoUrl?.split('/').pop()?.replace('.git', '') || 'Previous Analysis'}
                      </h4>
                      <p className="text-neutral-500 text-xs mt-1">
                        {(recentInterview.questions?.length ?? 0)} Questions • {recentInterview.timestamp ? new Date(recentInterview.timestamp).toLocaleDateString() : 'Recent'}
                      </p>
                    </div>
                  </div>
                  <IconArrowRight className="h-5 w-5 text-neutral-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </Card>
              </div>
            )}
          </div>
        )}

        {/* Results Section */}
        {interviewData && (
          <div className="relative z-10 px-4 sm:px-8 pb-20 pt-8 max-w-7xl mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-5 duration-700">
            {renderAnalyzeBox(true)}
            {/* Back Button */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <Button 
                onClick={() => setInterviewData(null)}
                variant="ghost" 
                className="text-neutral-400 hover:text-white px-0 hover:bg-transparent"
              >
                <IconChevronLeft className="h-4 w-4 mr-1" />
                Back to Dashboard
              </Button>
              <Badge variant="outline" className="border-neutral-800 text-neutral-500 max-w-full truncate">
                {interviewData.repoUrl || 'No repository URL'}
              </Badge>
            </div>
            <div className="bg-neutral-900/50 backdrop-blur-md border border-neutral-800 p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <IconBriefcase className="h-5 w-5 text-blue-400" />
                <h4 className="text-blue-400 font-bold uppercase tracking-wider text-sm">Repository Summary</h4>
              </div>
              <p className="text-neutral-300 leading-relaxed text-lg italic">
                "{interviewData.summary}"
              </p>
            </div>

            {/* Questions Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="col-span-full mb-2">
                <div className="flex items-center gap-2">
                  <IconHelp className="h-5 w-5 text-purple-400" />
                  <h4 className="text-purple-400 font-bold uppercase tracking-wider text-sm">Core Questions</h4>
                </div>
              </div>
              {interviewData.questions.map((q, idx) => (
                <Card key={idx} className="bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 transition-colors">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <Badge className={`${getDifficultyColor(q.difficulty)} border px-2 py-0.5 text-[10px]`}>
                        {q.difficulty}
                      </Badge>
                      <Badge variant="outline" className="text-neutral-500 border-neutral-800 text-[10px]">
                        {q.type}
                      </Badge>
                    </div>
                    <CardTitle className="text-white text-base mt-2 line-clamp-3 leading-snug">
                      {q.question}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 mt-2">
                      <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-tight">Expected Points</p>
                      <ul className="space-y-1">
                        {q.expected_points.map((pt, pIdx) => (
                          <li key={pIdx} className="text-neutral-400 text-xs flex gap-2">
                            <span className="text-purple-500/50">•</span>
                            {pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Hands-on Task */}
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <IconCode className="h-5 w-5 text-green-400" />
                  <h4 className="text-green-400 font-bold uppercase tracking-wider text-sm">Coding Challenge</h4>
                </div>
                <div className="bg-black/40 border border-neutral-800/50 p-4 rounded-xl mb-6">
                  <p className="text-neutral-200 text-sm whitespace-pre-wrap leading-relaxed">
                    {interviewData.hands_on_task.prompt}
                  </p>
                </div>
                <div className="space-y-3">
                  <p className="text-neutral-500 text-[10px] font-bold uppercase tracking-tight">Evaluation Rubric</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {interviewData.hands_on_task.evaluation_rubric.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-neutral-800/30 p-2 rounded-lg border border-neutral-800">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500/50" />
                        <span className="text-neutral-400 text-xs">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Follow-ups */}
            <div className="bg-neutral-900/30 border border-neutral-800/50 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <IconBulb className="h-5 w-5 text-yellow-400" />
                <h4 className="text-yellow-400 font-bold uppercase tracking-wider text-sm">Follow-up Discussion</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {interviewData.follow_ups.map((item, idx) => (
                  <div key={idx} className="bg-neutral-800/50 border border-neutral-700/30 px-3 py-1.5 rounded-full text-neutral-400 text-xs">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Quickstart
