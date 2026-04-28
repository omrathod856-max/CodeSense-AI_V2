import { GridBackgroundDemo } from '@/components/ui/gridbackground';
import Navbar from './navbar';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconHistory, IconTrash, IconListCheck, IconMicrophone, IconTrophy } from '@tabler/icons-react';

interface HistoryItem {
  _id: string;
  summary: string;
  repoUrl?: string;
  createdAt?: string;
  questions?: Array<unknown>;
  follow_ups?: Array<unknown>;
  hands_on_task?: {
    prompt?: string;
    evaluation_rubric?: string[];
  };
}

interface VoiceSessionItem {
  _id: string;
  candidateName: string;
  repoUrl?: string;
  endedAt?: string;
  evaluation: {
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
  };
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

function Recentactivity() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [voiceHistory, setVoiceHistory] = useState<VoiceSessionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await axios.get(`${BACKEND_URL}/interview/recent?limit=50`, {
          withCredentials: true,
        });
        setHistory(response.data?.interviews || []);
        setVoiceHistory(response.data?.voiceSessions || []);
      } catch (err) {
        console.error('Failed to load history:', err);
        setHistory([]);
        setVoiceHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const clearAll = () => {
    axios.delete(`${BACKEND_URL}/interview`, { withCredentials: true })
      .finally(() => {
        setHistory([]);
        setVoiceHistory([]);
      });
  };

  const removeOne = (target: HistoryItem) => {
    axios.delete(`${BACKEND_URL}/interview/${target._id}`, { withCredentials: true })
      .finally(() => {
        setHistory((prev) => prev.filter((item) => item._id !== target._id));
      });
  };

  const removeVoiceSession = (id: string) => {
    axios.delete(`${BACKEND_URL}/interview/voice/${id}`, { withCredentials: true })
      .finally(() => {
        setVoiceHistory((prev) => prev.filter((item) => item._id !== id));
      });
  };

  const openInterview = (item: HistoryItem) => {
    navigate('/quickstart', {
      state: {
        interview: {
          _id: item._id,
          summary: item.summary,
          questions: Array.isArray(item.questions) ? item.questions : [],
          hands_on_task: {
            prompt: item.hands_on_task?.prompt || 'No coding task available.',
            evaluation_rubric: Array.isArray(item.hands_on_task?.evaluation_rubric)
              ? item.hands_on_task?.evaluation_rubric
              : [],
          },
          follow_ups: Array.isArray(item.follow_ups) ? item.follow_ups : [],
          repoUrl: item.repoUrl,
          createdAt: item.createdAt,
          timestamp: item.createdAt ? new Date(item.createdAt).getTime() : Date.now(),
        },
      },
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black overflow-hidden">
      <Navbar />
      <div className="flex-1 relative isolate overflow-y-auto bg-black min-h-0">
        <GridBackgroundDemo />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-4 sm:px-8 pt-24 sm:pt-28 pb-16 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <IconHistory className="h-5 w-5 text-blue-400" />
              <h2 className="text-white text-xl font-semibold">Recent Activity</h2>
            </div>
            <Button
              variant="ghost"
              onClick={clearAll}
              className="text-neutral-400 hover:text-red-400 hover:bg-transparent"
              disabled={history.length === 0}
            >
              <IconTrash className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>

          {loading ? (
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="py-10 text-center text-neutral-400">
                Loading recent activity...
              </CardContent>
            </Card>
          ) : history.length === 0 && voiceHistory.length === 0 ? (
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="py-10 text-center text-neutral-400">
                No activity generated yet. Run an analysis or simulation to populate this section.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-8">
              {/* Voice Interviews Section */}
              {voiceHistory.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <IconMicrophone className="h-4 w-4 text-green-400" />
                    <h3 className="text-white text-lg font-medium">Interview Performance</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {voiceHistory.map((item) => (
                      <Card
                        key={item._id}
                        className="bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 transition-colors group"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="min-w-0 flex-1 mr-2">
                              <CardTitle className="text-white text-base truncate">
                                {item.repoUrl || 'Mock Session'}
                              </CardTitle>
                              <p className="text-neutral-500 text-xs mt-1">
                                Completed {item.endedAt ? new Date(item.endedAt).toLocaleString() : 'Recently'}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {item.evaluation && (
                                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-full">
                                  <IconTrophy className="h-3 w-3 text-blue-400" />
                                  <span className="text-sm font-bold text-blue-400">{item.evaluation.score}%</span>
                                </div>
                              )}
                              <Button
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeVoiceSession(item._id);
                                }}
                                className="text-neutral-500 hover:text-red-400 hover:bg-transparent h-8 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <IconTrash className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {item.evaluation && (
                            <>
                              <p className="text-neutral-300 text-sm italic leading-relaxed line-clamp-2 mb-3">
                                "{item.evaluation.feedback}"
                              </p>
                              <div className="flex gap-2">
                                <Badge variant="outline" className="border-green-500/20 text-green-400 text-[10px]">
                                  {item.evaluation.strengths?.length || 0} Strengths
                                </Badge>
                                <Badge variant="outline" className="border-red-500/20 text-red-400 text-[10px]">
                                  {item.evaluation.weaknesses?.length || 0} Weak Spots
                                </Badge>
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Repo Analyses Section */}
              {history.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <IconListCheck className="h-4 w-4 text-blue-400" />
                    <h3 className="text-white text-lg font-medium">Repository Analyses</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {history.map((item, idx) => (
                      <Card
                        key={`${item._id}-${idx}`}
                        className="bg-neutral-900/60 border-neutral-800 cursor-pointer hover:border-neutral-600 transition-colors"
                        onClick={() => openInterview(item)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <CardTitle className="text-white text-base truncate">
                                {item.repoUrl || 'Repository'}
                              </CardTitle>
                              <p className="text-neutral-500 text-xs mt-1">
                                {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown time'}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeOne(item);
                              }}
                              className="text-neutral-500 hover:text-red-400 hover:bg-transparent h-8 px-2"
                            >
                              <IconTrash className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <p className="text-neutral-300 text-sm leading-relaxed line-clamp-2">{item.summary || 'No summary available.'}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="border-neutral-700 text-neutral-400">
                              {(item.questions?.length ?? 0)} Questions
                            </Badge>
                            <Badge variant="outline" className="border-neutral-700 text-neutral-400">
                              <IconListCheck className="h-3 w-3 mr-1" />
                              {(item.follow_ups?.length ?? 0)} Follow-ups
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </div>
  );
}

export default Recentactivity
