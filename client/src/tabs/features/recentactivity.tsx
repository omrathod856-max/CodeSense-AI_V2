import { GridBackgroundDemo } from '@/components/ui/gridbackground';
import Navbar from './navbar';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { IconHistory, IconTrash, IconListCheck } from '@tabler/icons-react';

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


function Recentactivity() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await axios.get('http://localhost:3000/interview/recent?limit=50', {
          withCredentials: true,
        });
        const list = Array.isArray(response.data?.data) ? response.data.data : [];
        setHistory(list);
      } catch {
        setHistory([]);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, []);

  const clearAll = () => {
    axios.delete('http://localhost:3000/interview', { withCredentials: true })
      .finally(() => setHistory([]));
  };

  const removeOne = (target: HistoryItem) => {
    axios.delete(`http://localhost:3000/interview/${target._id}`, { withCredentials: true })
      .finally(() => {
        setHistory((prev) => prev.filter((item) => item._id !== target._id));
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
                Loading recent interviews...
              </CardContent>
            </Card>
          ) : history.length === 0 ? (
            <Card className="bg-neutral-900/60 border-neutral-800">
              <CardContent className="py-10 text-center text-neutral-400">
                No interviews generated yet. Run an analysis in Quick Start to populate this section.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
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
                    <p className="text-neutral-300 text-sm leading-relaxed line-clamp-3">{item.summary || 'No summary available.'}</p>
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
          )}
        </div>
      </div>
      </div>
  );
}

export default Recentactivity
