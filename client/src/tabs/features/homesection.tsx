import { GridBackgroundDemo } from '@/components/ui/gridbackground';
import { LayoutTextFlip } from '@/components/ui/layout-text-flip';
import { Link, useLocation } from 'react-router-dom';
import Navbar from './navbar';

const quickActions = [
  {
    title: 'Start Interview Prep',
    description: 'Analyze a repository and generate tailored technical interview questions.',
    href: '/quickstart',
    cta: 'Open Quick Start',
  },
  {
    title: 'Recent Activity',
    description: 'Continue where you left off by reviewing your latest generated interviews.',
    href: '/recentactivity',
    cta: 'Open History',
  },
  {
    title: 'Interview Simulator',
    description: 'Practice your interview skills with our interactive simulator.',
    href: '/interview',
    cta: 'Try Simulator',
  },
];

function HomeSection() {
  const location = useLocation();
  const username = location.state?.username;

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black">
      <Navbar />
      <main className="flex-1 relative overflow-y-auto bg-black min-h-0">
        <GridBackgroundDemo />

        <div className="absolute inset-x-0 top-0 z-20 pointer-events-none px-4 pt-10 sm:pt-16 md:pt-20">
          <div className="mx-auto flex max-w-5xl justify-center gap-2 sm:gap-4 text-center">
            <LayoutTextFlip text={'CodeSense helps you'} words={['Analyze Repos', 'Fix Logic Gaps', 'Master Technicals']} />
          </div>
        </div>

        <section className="relative z-20 mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-10 pt-36 sm:pt-40 md:px-8 md:pt-44">
          <p className="text-center text-sm text-neutral-300">
            Pick a flow below to move faster through your prep.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {quickActions.map((action) => (
              <article
                key={action.href}
                className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-5 backdrop-blur-sm transition-colors hover:border-neutral-600"
              >
                <h2 className="text-lg font-semibold text-white">{action.title}</h2>
                <p className="mt-2 text-sm text-neutral-300">{action.description}</p>
                <Link
                  to={action.href}
                  state={{ username }}
                  className="mt-4 inline-flex items-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-black transition-colors hover:bg-neutral-200"
                >
                  {action.cta}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

export default HomeSection
