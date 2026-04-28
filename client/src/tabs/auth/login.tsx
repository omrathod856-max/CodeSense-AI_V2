import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

const Login = () => {
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${BACKEND_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      });

      if (response.ok) {
        const data = await response.json();
        document.cookie = `token=${data.token}; path=/;`;
        navigate('/homesection', { state: { username: data.username } });
      } else {
        console.error('Login failed');
        alert('Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // GitHub uses a very specific dark gray (Hex #0d1117)
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0d1117] text-[#e6edf3] font-sans px-4">
      
      {/* GitHub-style Logo Header */}
      <div className="mb-8 flex flex-col items-center">
        <h1 className="text-2xl font-light tracking-tight">Sign in to CodeSense</h1>
      </div>

      <Card className="w-full max-w-85 p-5 bg-[#161b22] border-[#30363d] rounded-md shadow-none">
        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-2">
            <label className="text-sm font-normal text-[#e6edf3]">Email address</label>
            <Input
              className="bg-[#0d1117] border-[#30363d] text-white focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500 rounded-md h-8"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-sm font-normal text-[#e6edf3]">Password</label>
            </div>
            <Input
              className="bg-[#0d1117] border-[#30363d] text-white focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:border-blue-500 rounded-md h-8"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <Button
            className="w-full h-8 bg-[#0453c2] hover:bg-[#0066f4] text-white font-semibold rounded-md transition-colors text-sm"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </Card>

      {/* Footer "New to..." Section */}
      <div className="w-full max-w-85 mt-4 p-4 border border-[#30363d] rounded-md text-center text-sm">
        <span className="text-[#e6edf3]">New to CodeSense? </span>
        <Link to="/signup" className="text-[#2f81f7] hover:underline">
          Create an account
        </Link>
      </div>

      {/* Bottom Legal Links */}
      {/* <div className="mt-16 flex gap-4 text-xs text-[#8b949e]">
        <span className="hover:text-[#2f81f7] cursor-pointer">Terms</span>
        <span className="hover:text-[#2f81f7] cursor-pointer">Privacy</span>
        <span className="hover:text-[#2f81f7] cursor-pointer">Docs</span>
        <span className="text-gray-600">Contact CodeSense</span>
      </div> */}
    </div>
  );
};

export default Login;