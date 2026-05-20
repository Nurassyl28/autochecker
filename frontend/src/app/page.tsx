import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-[Inter,sans-serif] overflow-x-hidden">
      {/* ── NAVBAR ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 h-[70px] flex items-center px-14">
        <span className="text-[22px] font-medium text-black tracking-tight">Autochecker</span>
        <nav className="flex items-center gap-10 ml-14">
          <a href="#students" className="text-[20px] font-medium text-[#373737] hover:text-[#3525cd] transition-colors">Students</a>
          <a href="#instructor" className="text-[20px] font-medium text-[#373737] hover:text-[#3525cd] transition-colors">Instructor</a>
          <a href="#resources" className="text-[20px] font-medium text-[#373737] hover:text-[#3525cd] transition-colors">Resources</a>
        </nav>
        <div className="ml-auto flex items-center gap-6">
          <Link href="/login" className="text-[20px] font-medium text-[#373737] hover:text-[#3525cd] transition-colors">
            Sign in
          </Link>
          <Link
            href="/login"
            className="bg-[#3525cd] text-white text-[16px] font-medium px-6 py-2.5 rounded-[8px] hover:bg-[#2a1fb5] transition-colors"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* ── HERO ── */}
      <main className="pt-[70px]">
        <section
          className="relative min-h-[680px] flex flex-col items-center justify-center text-center px-6"
          style={{
            background: "linear-gradient(180deg, #f0f1ff 0%, #f7f8ff 40%, #ffffff 100%)",
          }}
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-[#c8c9f8] rounded-full px-4 py-1.5 mb-8 shadow-sm">
            <span className="text-[#3525cd] text-[13px]">✦</span>
            <span className="text-[#3525cd] text-[13px] font-medium tracking-wider uppercase">Next-Gen AI Education</span>
          </div>

          <h1 className="text-[58px] font-bold text-black leading-tight max-w-[700px] mb-6">
            AI Learning Platform
          </h1>
          <p className="text-[18px] text-[#555] max-w-[520px] leading-relaxed mb-10">
            Experience the future of coding education with automated feedback and smart diagnostics.
            Personalize your learning journey with our advanced AI tools.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-4 mb-12">
            <Link
              href="/login"
              className="bg-[#3525cd] text-white text-[16px] font-medium px-8 py-3.5 rounded-[10px] hover:bg-[#2a1fb5] transition-all shadow-[0_4px_20px_rgba(53,37,205,0.3)]"
            >
              I&apos;m a Student
            </Link>
            <Link
              href="/login"
              className="bg-white text-[#3525cd] text-[16px] font-medium px-8 py-3.5 rounded-[10px] border border-[#3525cd] hover:bg-[#f0f0ff] transition-colors"
            >
              I&apos;m a Teacher
            </Link>
          </div>

          {/* Search demo */}
          <div className="bg-white rounded-[16px] shadow-[0_4px_30px_rgba(0,0,0,0.08)] flex items-center gap-3 px-5 py-4 w-full max-w-[600px]">
            <span className="text-[#3525cd] text-[18px]">📍</span>
            <span className="text-[#9ca3af] text-[15px] flex-1 text-left">
              Analyze my React component for performance bottlenecks...
            </span>
            <button className="bg-[#3525cd] text-white w-9 h-9 rounded-[8px] flex items-center justify-center hover:bg-[#2a1fb5] transition-colors">
              →
            </button>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="py-24 px-14 bg-white" id="students">
          <div className="max-w-[1200px] mx-auto grid grid-cols-2 gap-6 mb-6">
            {/* Student AI Tutor */}
            <div className="bg-white border border-[#ebebeb] rounded-[20px] p-8 shadow-sm">
              <div className="bg-[#3525cd] w-12 h-12 rounded-[12px] flex items-center justify-center mb-5">
                <span className="text-white text-[20px]">🎓</span>
              </div>
              <h3 className="text-[26px] font-bold text-black mb-3">Student AI Tutor</h3>
              <p className="text-[15px] text-[#555] leading-relaxed mb-6">
                Your personalized code companion. Explain real-time coding help, debug complex
                algorithms, and get architectural suggestions to improve your craft.
              </p>
              <div className="space-y-3">
                <div className="bg-[#f8f9fb] rounded-[12px] px-4 py-3 flex items-start gap-3">
                  <span className="text-[14px] mt-0.5">🔧</span>
                  <div>
                    <p className="text-[14px] font-semibold text-black">Real-time Feedback</p>
                    <p className="text-[13px] text-[#777]">Instant linting and logic checks as you type.</p>
                  </div>
                </div>
                <div className="bg-[#f8f9fb] rounded-[12px] px-4 py-3 flex items-start gap-3">
                  <span className="text-[14px] mt-0.5">🐛</span>
                  <div>
                    <p className="text-[14px] font-semibold text-black">Smart Debugger</p>
                    <p className="text-[13px] text-[#777]">Identify root causes of errors with step-by-step logic tracing.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Instructor AI */}
            <div className="bg-[#f5f5ff] border border-[#e0deff] rounded-[20px] p-8 shadow-sm" id="instructor">
              <div className="bg-[#3525cd] w-12 h-12 rounded-[12px] flex items-center justify-center mb-5">
                <span className="text-white text-[20px]">✅</span>
              </div>
              <h3 className="text-[26px] font-bold text-black mb-3">Instructor AI</h3>
              <p className="text-[15px] text-[#555] leading-relaxed mb-6">
                Automate grading, identify individual student struggles, and assist in curriculum
                development through data-driven insights.
              </p>
              <div className="bg-white rounded-[12px] p-4 shadow-sm">
                <p className="text-[11px] font-semibold text-[#777] uppercase tracking-wider mb-2">Class Performance</p>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 bg-[#e8e8e8] rounded-full h-2">
                    <div className="bg-[#3525cd] h-2 rounded-full" style={{ width: "82%" }} />
                  </div>
                  <span className="text-[#3525cd] text-[13px]">↗</span>
                </div>
                <p className="text-[13px] text-[#555]">82% of students completed &apos;Redux Hooks&apos; module</p>
              </div>
            </div>
          </div>

          {/* Bottom 3 feature cards */}
          <div className="max-w-[1200px] mx-auto grid grid-cols-3 gap-6">
            <div className="bg-white border border-[#ebebeb] rounded-[20px] p-6 shadow-sm">
              <span className="text-[28px] mb-3 block">📋</span>
              <h4 className="text-[16px] font-semibold text-black mb-2">Smart Curricula</h4>
              <p className="text-[14px] text-[#666] leading-relaxed">
                AI generates custom exercises based on class performance and individual learning gaps.
              </p>
            </div>
            <div className="bg-white border border-[#ebebeb] rounded-[20px] p-6 shadow-sm">
              <span className="text-[28px] mb-3 block">⚡</span>
              <h4 className="text-[16px] font-semibold text-black mb-2">Fast Integration</h4>
              <p className="text-[14px] text-[#666] leading-relaxed">
                Seamlessly connects with GitHub, GitLab, and most modern LMS platforms.
              </p>
            </div>
            <div className="bg-[#1a1a2e] rounded-[20px] p-6 shadow-sm">
              <span className="text-[28px] mb-3 block">🛡️</span>
              <h4 className="text-[16px] font-semibold text-white mb-2">Secure Sandboxing</h4>
              <p className="text-[14px] text-[#aaa] leading-relaxed">
                Isolated containers for students to run code without compromising server safety.
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section className="px-14 pb-24">
          <div
            className="max-w-[1200px] mx-auto rounded-[24px] border-2 border-[#3525cd] p-12 flex items-center justify-between gap-8"
            style={{ background: "linear-gradient(135deg, #f8f8ff 0%, #f0efff 100%)" }}
          >
            <div className="flex-1">
              <h2 className="text-[36px] font-bold text-black leading-tight mb-4">
                Ready to evolve your coding education?
              </h2>
              <p className="text-[16px] text-[#555] mb-8 leading-relaxed">
                Join 50,000+ students and instructors who are scaling their technical skills with
                precision-engineered AI feedback.
              </p>
              <div className="flex gap-4">
                <Link
                  href="/login"
                  className="bg-[#3525cd] text-white text-[16px] font-medium px-7 py-3 rounded-[10px] hover:bg-[#2a1fb5] transition-colors"
                >
                  Start Your Journey
                </Link>
                <button className="bg-white text-black text-[16px] font-medium px-7 py-3 rounded-[10px] border border-[#ddd] hover:bg-gray-50 transition-colors">
                  Contact Sales
                </button>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-[180px] h-[160px] rounded-[16px] overflow-hidden bg-[#222]">
                <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                  <span className="text-5xl">👨‍💻</span>
                </div>
              </div>
              <div className="w-[180px] h-[160px] rounded-[16px] overflow-hidden bg-[#111]">
                <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-950 flex items-center justify-center">
                  <span className="text-5xl">💻</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="bg-white border-t border-[#eee] px-14 py-10 flex items-start justify-between">
        <div>
          <p className="text-[16px] font-semibold text-black mb-2">EduCode AI</p>
          <p className="text-[13px] text-[#777] max-w-[220px] leading-relaxed">
            Precision-engineered learning. Building the infrastructure for the next generation of software engineers.
          </p>
          <p className="text-[12px] text-[#999] mt-4">© 2026 EduCode AI. Precision-engineered learning.</p>
        </div>
        <div className="grid grid-cols-3 gap-x-16 gap-y-2 text-[14px] text-[#555]">
          <a href="#" className="hover:text-[#3525cd] transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-[#3525cd] transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-[#3525cd] transition-colors">Documentation</a>
          <a href="#" className="hover:text-[#3525cd] transition-colors">Contact Support</a>
          <a href="#" className="hover:text-[#3525cd] transition-colors">GitHub</a>
          <a href="#" className="hover:text-[#3525cd] transition-colors">Discord</a>
        </div>
      </footer>
    </div>
  );
}
