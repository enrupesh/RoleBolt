import { useState, type ReactNode } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Menu,
  MoveUpRight,
  Play,
  Sparkles,
  X,
} from 'lucide-react';

const base = '/__mockup/images/landing/';

function Logo() {
  return (
    <a href="#top" className="flex items-center gap-2.5" aria-label="Rolebolt home">
      <span className="grid h-8 w-8 place-items-center rounded-[10px] bg-[#d8654a] text-[#fbf5eb] shadow-[0_4px_12px_rgba(216,101,74,.22)]">
        <span className="text-[18px] font-bold leading-none">R</span>
      </span>
      <span className="font-semibold tracking-[-.03em] text-[#172e4b]">rolebolt</span>
    </a>
  );
}

function Button({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <button
      className={`group inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[13px] font-semibold transition duration-300 hover:-translate-y-0.5 ${
        light
          ? 'border border-[#d9cbb9] bg-[#fbf5eb] text-[#1a3655] hover:bg-white'
          : 'bg-[#d8654a] text-[#fff8ef] shadow-[0_8px_22px_rgba(216,101,74,.2)] hover:bg-[#be523c]'
      }`}
    >
      {children}
      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
    </button>
  );
}

function ProductFrame({ src, alt, className = '' }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-[22px] border border-[#d9cdbd] bg-[#f4eee5] shadow-[0_22px_60px_rgba(29,49,72,.12)] ${className}`}>
      <div className="flex h-8 items-center gap-1.5 border-b border-[#ded2c3] bg-[#faf6ee] px-4">
        <Circle className="h-2 w-2 fill-[#d9a18b] text-[#d9a18b]" />
        <Circle className="h-2 w-2 fill-[#d7b77e] text-[#d7b77e]" />
        <Circle className="h-2 w-2 fill-[#adc1b8] text-[#adc1b8]" />
      </div>
      <img src={`${base}${src}`} alt={alt} className="block h-auto w-full" />
    </div>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const faqs = [
    ['Is Rolebolt an ATS?', 'It is the focused workspace between an ATS and a spreadsheet: a calmer place to make decisions, keep context, and move the right people forward.'],
    ['Can candidates use Rolebolt too?', 'Yes. Candidates get a clear, respectful path through applications, updates, and next steps without chasing a black box.'],
    ['How quickly can a team get started?', 'Most teams are ready to run their first role in an afternoon. Import a role, shape your signals, and invite the people who should have a voice.'],
  ];

  return (
    <main id="top" className="overflow-hidden bg-[#f7f1e8] text-[#172e4b] selection:bg-[#d8654a] selection:text-[#fff8ef]">
      <nav className="sticky top-0 z-40 border-b border-[#e4d9ca]/80 bg-[#f7f1e8]/90 px-5 backdrop-blur-md md:px-10">
        <div className="mx-auto flex h-[76px] max-w-[1240px] items-center justify-between">
          <Logo />
          <div className="hidden items-center gap-8 text-[13px] font-medium text-[#597087] md:flex">
            <a href="#product" className="transition hover:text-[#d8654a]">Product</a>
            <a href="#for-teams" className="transition hover:text-[#d8654a]">For teams</a>
            <a href="#for-candidates" className="transition hover:text-[#d8654a]">For candidates</a>
            <a href="#resources" className="transition hover:text-[#d8654a]">Resources</a>
          </div>
          <div className="hidden items-center gap-5 md:flex">
            <a href="#pricing" className="text-[13px] font-semibold text-[#597087] hover:text-[#d8654a]">Pricing</a>
            <Button>Start for free</Button>
          </div>
          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && <div className="border-t border-[#e4d9ca] py-4 md:hidden"><div className="flex flex-col gap-4 text-sm"><a href="#product" onClick={() => setMenuOpen(false)}>Product</a><a href="#for-teams" onClick={() => setMenuOpen(false)}>For teams</a><a href="#pricing" onClick={() => setMenuOpen(false)}>Pricing</a><Button>Start for free</Button></div></div>}
      </nav>

      <section className="relative mx-auto max-w-[1240px] px-5 pb-24 pt-20 md:px-10 md:pb-32 md:pt-28">
        <div className="absolute -right-32 top-10 h-80 w-80 rounded-full bg-[#e8c9a9]/25 blur-3xl" />
        <div className="relative grid items-end gap-12 lg:grid-cols-[.9fr_1.1fr]">
          <div className="max-w-[620px]">
            <p className="mb-6 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.2em] text-[#d8654a]"><Sparkles className="h-3.5 w-3.5" /> Hiring, with more human signal</p>
            <h1 className="font-['Instrument_Serif'] text-[clamp(4rem,8vw,7.8rem)] leading-[.84] tracking-[-.06em] text-[#183552]">Good people<br /><em className="text-[#d8654a]">deserve</em> a better<br />next step.</h1>
            <p className="mt-8 max-w-[475px] text-[17px] leading-8 text-[#5b6e7e]">Rolebolt gives hiring teams the signal to decide well — and gives candidates a clear, connected path from application to yes.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4"><Button>Build your workspace</Button><a href="#how-it-works" className="group inline-flex items-center gap-2 text-[13px] font-semibold text-[#1e4669]"><span className="grid h-9 w-9 place-items-center rounded-full border border-[#cbbca9] bg-[#fbf5eb] transition group-hover:bg-white"><Play className="ml-0.5 h-3.5 w-3.5 fill-current" /></span> See how it works</a></div>
            <div className="mt-16 flex items-center gap-4 border-t border-[#ddcfbf] pt-5 text-[12px] text-[#74818c]"><span className="flex -space-x-2"><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#f7f1e8] bg-[#d4a37e] text-[10px] font-bold text-white">AM</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#f7f1e8] bg-[#70869a] text-[10px] font-bold text-white">JW</span><span className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#f7f1e8] bg-[#d8654a] text-[10px] font-bold text-white">SK</span></span><span>Trusted by thoughtful teams<br /><strong className="text-[#40586e]">building what matters next.</strong></span></div>
          </div>
          <div className="relative lg:pb-5"><div className="absolute -left-8 top-14 z-10 hidden rounded-2xl border border-[#d8c7b2] bg-[#fffaf2] p-4 shadow-[0_15px_40px_rgba(29,49,72,.14)] sm:block"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8b938f]">Today’s signal</p><p className="mt-2 text-sm font-semibold text-[#1a3655]">3 people worth a closer look</p><div className="mt-3 flex gap-1"><span className="h-1.5 w-10 rounded-full bg-[#d8654a]" /><span className="h-1.5 w-5 rounded-full bg-[#e6c4a8]" /><span className="h-1.5 w-8 rounded-full bg-[#b4c9bb]" /></div></div><ProductFrame src="recruitment-pipeline.png" alt="Rolebolt recruitment pipeline workspace" className="rotate-[1.5deg] lg:ml-5" /></div>
        </div>
      </section>

      <section className="border-y border-[#e3d6c5] bg-[#efe6da] px-5 py-7 md:px-10"><div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-5"><p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#7d887f]">A workspace for the whole conversation</p><div className="flex flex-wrap gap-x-8 gap-y-2 text-sm font-semibold text-[#516b79]"><span>Hiring teams</span><span className="text-[#d8654a]">Candidates</span><span>Interviewers</span><span>Leadership</span></div></div></section>

      <section id="product" className="mx-auto max-w-[1240px] px-5 py-24 md:px-10 md:py-36"><div className="grid gap-14 lg:grid-cols-[.75fr_1.25fr] lg:items-center"><div><p className="mb-5 text-[11px] font-bold uppercase tracking-[.2em] text-[#d8654a]">The signal, not the noise</p><h2 className="font-['Instrument_Serif'] text-5xl leading-[.94] tracking-[-.04em] text-[#183552] md:text-7xl">Make room for<br /><span className="text-[#d8654a]">better judgement.</span></h2><p className="mt-7 max-w-[410px] text-[16px] leading-7 text-[#5b6e7e]">A single place to see what matters, share the context, and move with intention. Rolebolt turns scattered hiring work into a readable story.</p><a href="#how-it-works" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#1e4669]">Explore the workspace <MoveUpRight className="h-4 w-4" /></a></div><ProductFrame src="talent-pool.png" alt="Rolebolt talent pool view" className="lg:translate-y-8" /></div></section>

      <section id="for-teams" className="bg-[#193a59] px-5 py-24 text-[#f7f1e8] md:px-10 md:py-36"><div className="mx-auto max-w-[1240px]"><div className="grid gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-end"><div><p className="mb-5 text-[11px] font-bold uppercase tracking-[.2em] text-[#e7a28c]">For hiring teams</p><h2 className="font-['Instrument_Serif'] text-5xl leading-[.94] tracking-[-.04em] md:text-7xl">Run a process<br />people can <em className="text-[#e7a28c]">feel.</em></h2></div><p className="max-w-[430px] text-[16px] leading-7 text-[#cad4d7]">The best hiring process is not the one with the most steps. It is the one where every person knows what is happening, why it matters, and what comes next.</p></div><div className="mt-16 grid gap-5 md:grid-cols-3"><div className="border-t border-[#52708a] pt-5"><span className="font-['Instrument_Serif'] text-4xl text-[#e7a28c]">01</span><h3 className="mt-4 text-lg font-semibold">See the whole picture</h3><p className="mt-3 text-sm leading-6 text-[#b8c9d0]">Keep roles, candidates, notes, and decisions close enough to make sense together.</p></div><div className="border-t border-[#52708a] pt-5"><span className="font-['Instrument_Serif'] text-4xl text-[#e7a28c]">02</span><h3 className="mt-4 text-lg font-semibold">Make signals legible</h3><p className="mt-3 text-sm leading-6 text-[#b8c9d0]">Replace gut-feel fog with the details your team actually needs to discuss.</p></div><div className="border-t border-[#52708a] pt-5"><span className="font-['Instrument_Serif'] text-4xl text-[#e7a28c]">03</span><h3 className="mt-4 text-lg font-semibold">Move with care</h3><p className="mt-3 text-sm leading-6 text-[#b8c9d0]">Thoughtful outreach, timely updates, and fewer dropped threads for everyone.</p></div></div></div></section>

      <section id="how-it-works" className="mx-auto max-w-[1240px] px-5 py-24 md:px-10 md:py-36"><div className="grid gap-14 lg:grid-cols-[1.05fr_.95fr] lg:items-center"><ProductFrame src="outreach.png" alt="Rolebolt candidate outreach composer" className="order-2 lg:order-1" /><div className="order-1 lg:order-2"><p className="mb-5 text-[11px] font-bold uppercase tracking-[.2em] text-[#d8654a]">A better handoff</p><h2 className="font-['Instrument_Serif'] text-5xl leading-[.94] tracking-[-.04em] text-[#183552] md:text-7xl">The next step<br /><span className="text-[#d8654a]">should feel close.</span></h2><p className="mt-7 max-w-[440px] text-[16px] leading-7 text-[#5b6e7e]">Write the update you would want to receive. Rolebolt keeps every message personal, timely, and connected to the work behind it.</p><div className="mt-8 space-y-3 text-sm text-[#526878]"><p className="flex items-center gap-3"><Check className="h-4 w-4 text-[#d8654a]" /> Context travels with the candidate</p><p className="flex items-center gap-3"><Check className="h-4 w-4 text-[#d8654a]" /> Templates that still sound human</p><p className="flex items-center gap-3"><Check className="h-4 w-4 text-[#d8654a]" /> A clear record of every promise made</p></div></div></div></section>

      <section id="for-candidates" className="bg-[#e7d5c1] px-5 py-24 md:px-10 md:py-32"><div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[.8fr_1.2fr] lg:items-center"><div><p className="mb-5 text-[11px] font-bold uppercase tracking-[.2em] text-[#a6533e]">For candidates</p><h2 className="font-['Instrument_Serif'] text-5xl leading-[.95] tracking-[-.04em] text-[#183552] md:text-7xl">No more<br /><em className="text-[#a6533e]">application voids.</em></h2><p className="mt-7 max-w-[420px] text-[16px] leading-7 text-[#536775]">A job search has enough uncertainty. Rolebolt makes the path visible, so a no is kind, a maybe has meaning, and a yes has momentum.</p><Button light>See the candidate view</Button></div><div className="relative"><div className="absolute -bottom-5 -left-4 z-10 max-w-[220px] rounded-2xl bg-[#fff9f0] p-5 shadow-[0_15px_35px_rgba(57,45,32,.15)]"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#8a938d]">A note from Maya</p><p className="mt-2 text-sm font-medium leading-5 text-[#29435b]">“I knew where things stood, even when the answer wasn’t yes yet.”</p></div><img src={`${base}interview.jpg`} alt="A thoughtful interview conversation" className="h-[430px] w-full rounded-[22px] object-cover shadow-[0_24px_55px_rgba(57,45,32,.16)] md:h-[560px]" /></div></div></section>

      <section className="mx-auto max-w-[1240px] px-5 py-24 md:px-10 md:py-36"><div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr]"><div className="relative overflow-hidden rounded-[24px] bg-[#d4a37e] p-8 text-[#fff8ef] md:p-12"><img src={`${base}team-collaboration.jpg`} alt="A hiring team collaborating around a table" className="absolute inset-0 h-full w-full object-cover opacity-25 mix-blend-multiply" /><div className="relative max-w-[560px]"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#fff0dd]">The human layer</p><h2 className="mt-10 font-['Instrument_Serif'] text-5xl leading-[.9] tracking-[-.04em] md:text-7xl">Hiring is a<br />conversation.</h2><p className="mt-7 max-w-[410px] text-[16px] leading-7 text-[#fff0dd]">Rolebolt gives that conversation a place to land — clear enough to act on, generous enough to keep people in view.</p></div></div><div className="flex flex-col justify-between rounded-[24px] border border-[#d8cbbb] bg-[#fbf5eb] p-8 md:p-10"><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#d8654a]">One workspace, many voices</p><div><p className="font-['Instrument_Serif'] text-4xl leading-none text-[#183552]">“The best tool we added was the one that helped us slow down.”</p><p className="mt-5 text-sm text-[#6d7b80]">— Lena Ortiz, Head of People at Northstar</p></div><div className="flex items-center justify-between border-t border-[#dfd2c3] pt-5 text-sm font-semibold text-[#1e4669]"><span>Read the story</span><MoveUpRight className="h-4 w-4" /></div></div></div></section>

      <section id="pricing" className="border-t border-[#e0d3c3] bg-[#fbf5eb] px-5 py-24 md:px-10 md:py-32"><div className="mx-auto max-w-[940px] text-center"><p className="mb-5 text-[11px] font-bold uppercase tracking-[.2em] text-[#d8654a]">Simple by design</p><h2 className="font-['Instrument_Serif'] text-5xl leading-none tracking-[-.04em] text-[#183552] md:text-7xl">Start with the work.<br /><em className="text-[#d8654a]">Grow from there.</em></h2><p className="mx-auto mt-6 max-w-[470px] text-[16px] leading-7 text-[#637582]">One thoughtful workspace for teams at every stage. No hidden tiers, no locked doors.</p><div className="mx-auto mt-12 max-w-[520px] rounded-[24px] border border-[#d7c7b4] bg-[#f3eadf] p-8 text-left shadow-[0_15px_35px_rgba(29,49,72,.06)] md:p-10"><div className="flex items-end justify-between"><div><p className="text-sm font-semibold text-[#587080]">Rolebolt workspace</p><p className="mt-2 font-['Instrument_Serif'] text-5xl text-[#183552]">$0 <span className="font-sans text-sm text-[#73818a]">to begin</span></p></div><span className="rounded-full bg-[#d8654a] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">Try it free</span></div><div className="my-7 h-px bg-[#dacbbb]" /><div className="grid gap-3 text-sm text-[#506877] sm:grid-cols-2"><span className="flex gap-2"><Check className="h-4 w-4 text-[#d8654a]" /> Unlimited candidates</span><span className="flex gap-2"><Check className="h-4 w-4 text-[#d8654a]" /> Shared team context</span><span className="flex gap-2"><Check className="h-4 w-4 text-[#d8654a]" /> Candidate updates</span><span className="flex gap-2"><Check className="h-4 w-4 text-[#d8654a]" /> No card required</span></div><div className="mt-8"><Button>Open your workspace</Button></div></div></div></section>

      <section id="resources" className="mx-auto max-w-[900px] px-5 py-24 md:py-32"><p className="text-center text-[11px] font-bold uppercase tracking-[.2em] text-[#d8654a]">Questions, answered</p><h2 className="mt-5 text-center font-['Instrument_Serif'] text-5xl tracking-[-.04em] text-[#183552] md:text-6xl">Take your time.</h2><div className="mt-12 divide-y divide-[#ddcfbf] border-y border-[#ddcfbf]">{faqs.map(([q, a], i) => <div key={q}><button onClick={() => setActiveFaq(activeFaq === i ? null : i)} className="flex w-full items-center justify-between py-6 text-left text-lg font-semibold text-[#23415c]"><span>{q}</span><ChevronDown className={`h-5 w-5 transition-transform ${activeFaq === i ? 'rotate-180 text-[#d8654a]' : ''}`} /></button>{activeFaq === i && <p className="max-w-[680px] pb-6 pr-8 text-[15px] leading-7 text-[#647783]">{a}</p>}</div>)}</div></section>

      <footer className="bg-[#193a59] px-5 pb-8 pt-16 text-[#e6edf0] md:px-10"><div className="mx-auto max-w-[1240px]"><div className="grid gap-12 md:grid-cols-[1.2fr_2fr]"><div><Logo /><p className="mt-6 max-w-[260px] text-sm leading-6 text-[#b8c9d0]">Better signals for hiring. A clearer next step for everyone.</p></div><div className="grid grid-cols-2 gap-8 text-sm sm:grid-cols-4"><div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.17em] text-[#e7a28c]">Explore</p><div className="space-y-3 text-[#c4d1d5]"><a href="#for-teams" className="block hover:text-white">About</a><a href="#resources" className="block hover:text-white">Blog</a><a href="#pricing" className="block hover:text-white">Pricing</a><a href="#top" className="block hover:text-white">Careers</a></div></div><div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.17em] text-[#e7a28c]">Connect</p><div className="space-y-3 text-[#c4d1d5]"><a href="#top" className="block hover:text-white">Contact</a><a href="#resources" className="block hover:text-white">Resources</a><a href="#for-candidates" className="block hover:text-white">Opportunities</a></div></div><div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.17em] text-[#e7a28c]">Legal</p><div className="space-y-3 text-[#c4d1d5]"><a href="#top" className="block hover:text-white">Privacy</a><a href="#top" className="block hover:text-white">Terms</a><a href="#top" className="block hover:text-white">Refunds</a><a href="#top" className="block hover:text-white">Billing</a></div></div><div><p className="mb-4 text-[10px] font-bold uppercase tracking-[.17em] text-[#e7a28c]">More</p><div className="space-y-3 text-[#c4d1d5]"><a href="#top" className="block hover:text-white">System status</a><a href="#top" className="block hover:text-white">Sitemap XML</a></div></div></div></div><div className="mt-16 flex flex-col justify-between gap-3 border-t border-[#52708a] pt-5 text-[11px] text-[#9fb4bd] sm:flex-row"><span>© 2025 Rolebolt Technologies</span><span>Made for people who care how work begins.</span></div></div></footer>
    </main>
  );
}

export function Premium() {
  return <App />;
}