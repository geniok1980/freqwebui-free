/** Landing FreqDash — аватар Юпитер + A2UI, realtime WebSocket (HerMes) */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/** Realtime WebSocket backend (NestJS gateway, тот же что у TMA/mobile). */
const WS_URL = 'wss://hermesmobile.freqdash.com';
/** Персона агента (совпадает с AGENT_PROFILES на бэкенде). */
const PROFILE = 'geniok';
/** PCM16 mono — стримится по session:audio:delta. */
const AUDIO_SAMPLE_RATE = 24000;

interface ServerMessage {
  event: string;
  data: unknown;
}

function cleanText(text: string): string {
  return text
    .replace(/\[(MOOD|GESTURE|POSE|EMOJI|LOOK):[^\]]*\]/g, '')
    .replace(/\[GAME\]/g, '')
    .trim();
}

export default function Landing() {
  const { i18n } = useTranslation();
  const [chatInput, setChatInput] = React.useState('');
  const [chatMsgs, setChatMsgs] = React.useState<Array<{ who: 'user' | 'bot'; text: string }>>([]);

  const wsRef = React.useRef<WebSocket | null>(null);
  const reconnectTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepaliveRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const accumRef = React.useRef<string>('');
  const streamingRef = React.useRef<boolean>(false);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const nextAudioTimeRef = React.useRef<number>(0);

  // --- Streaming PCM16 playback (24 kHz mono) — чанки стыкуются по времени ---
  const playPcmChunk = (base64: string) => {
    try {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const copy = new ArrayBuffer(bytes.length);
      new Uint8Array(copy).set(bytes);
      const pcm = new Int16Array(copy);
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctor({ sampleRate: AUDIO_SAMPLE_RATE });
      }
      const ctx = audioCtxRef.current;
      const buf = ctx.createBuffer(1, pcm.length, AUDIO_SAMPLE_RATE);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < pcm.length; i++) ch[i] = pcm[i] / 32768;
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      const when = Math.max(ctx.currentTime, nextAudioTimeRef.current);
      src.start(when);
      nextAudioTimeRef.current = when + buf.duration;
    } catch {
      /* ignore malformed chunk */
    }
  };

  const resetAudio = () => {
    nextAudioTimeRef.current = 0;
    try {
      audioCtxRef.current?.close?.();
    } catch {
      /* noop */
    }
    audioCtxRef.current = null;
  };

  // --- WebSocket lifecycle ---
  React.useEffect(() => {
    let cancelled = false;

    const connect = () => {
      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        // Анонимный пользователь — бэкенд скоупит память Mastra по userId.
        const uid =
          localStorage.getItem('fd_uid') ||
          ('u-' + Math.random().toString(36).slice(2, 9));
        localStorage.setItem('fd_uid', uid);
        ws.send(JSON.stringify({ event: 'user:register', data: { userId: uid } }));
        // Выбор персоны — бэкенд собирает сессию с нужным system prompt.
        ws.send(JSON.stringify({ event: 'profile:select', data: { profile: PROFILE } }));
        // Keepalive: NAT-ы роняют idle WebSocket.
        keepaliveRef.current = setInterval(() => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ event: 'ping' }));
          }
        }, 20000);
      };

      ws.onclose = () => {
        if (keepaliveRef.current) {
          clearInterval(keepaliveRef.current);
          keepaliveRef.current = null;
        }
        if (!cancelled) {
          reconnectTimerRef.current = setTimeout(connect, 2000);
        }
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          /* noop */
        }
      };

      ws.onmessage = (event) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }

        switch (msg.event) {
          case 'session:message:delta': {
            const d = String(((msg.data as any)?.delta as string) ?? '');
            accumRef.current += d;
            const shown = cleanText(accumRef.current);
            if (streamingRef.current) {
              setChatMsgs((m) => {
                const c = [...m];
                c[c.length - 1] = { who: 'bot', text: shown };
                return c;
              });
            } else {
              streamingRef.current = true;
              setChatMsgs((m) => [...m, { who: 'bot', text: shown }]);
            }
            break;
          }
          case 'session:message:done': {
            const full = cleanText(
              String(((msg.data as any)?.text as string) ?? accumRef.current) ||
                accumRef.current,
            );
            accumRef.current = '';
            streamingRef.current = false;
            setChatMsgs((m) => {
              const c = [...m];
              const last = c[c.length - 1];
              if (last && last.who === 'bot') {
                c[c.length - 1] = { who: 'bot', text: full };
              } else {
                c.push({ who: 'bot', text: full });
              }
              return c;
            });
            break;
          }
          case 'session:audio:delta': {
            const audio = (msg.data as any)?.audio as string | undefined;
            if (typeof audio === 'string' && audio) {
              const f = document.getElementById('fdAvatar') as HTMLIFrameElement | null;
              try {
                f?.contentWindow?.postMessage({ type: 'audio', base64: audio }, '*');
              } catch {
                /* noop */
              }
              playPcmChunk(audio);
            }
            break;
          }
          case 'session:audio:done':
          case 'session:ready':
          case 'connection:ack':
          case 'profile:active':
          case 'user:transcript':
            break;
          case 'error':
            console.warn('[Landing WS]', (msg.data as any)?.message);
            break;
          default:
            break;
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (keepaliveRef.current) clearInterval(keepaliveRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  /** Отправка через WebSocket; false — офлайн (не подключено). */
  const sendWS = (
    text: string,
    history?: Array<{ role: 'user' | 'assistant'; content: string }>,
  ): boolean => {
    const ws = wsRef.current;
    if (ws?.readyState !== WebSocket.OPEN) return false;
    accumRef.current = '';
    streamingRef.current = true;
    resetAudio();
    ws.send(JSON.stringify({ event: 'session:message', data: { text, history } }));
    return true;
  };

  const fallback = (q: string): string => {
    const l = q.toLowerCase();
    if (l.includes('бот') || l.includes('freqtrade'))
      return 'Делаем ботов на Freqtrade: стратегии с бэктестами 2–5 лет, деплой на Binance/Bybit. Бот под ключ — 45 000₽, стратегия — 25 000₽. Показать демо?';
    if (l.includes('цен') || l.includes('стоимо'))
      return 'FreqDash — бесплатно для управления своими ботами. Платные — стратегии и бот под ключ. Хотите смету?';
    return `Понял: «${q.slice(0, 60)}». Я консультант FreqDash — помогу с ботами, рисками и аналитикой. Уточните задачу?`;
  };

  const speakFallback = (text: string) => {
    setChatMsgs((m) =>
      m.length && m[m.length - 1].text === text ? m : [...m, { who: 'bot', text }],
    );
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ru-RU';
      u.rate = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
  };

  /** Кнопка "Нажми — заговорит": бот зачитывает приветствие через WS-агента. */
  const speak = () => {
    const greet = 'Поприветствуй посетителя сайта FreqDash и расскажи, чем ты можешь помочь с торговыми ботами, бэктестами и стратегиями.';
    if (!sendWS(greet)) {
      speakFallback(
        'Привет! Я ассистент FreqDash. Покажу боты, бэктесты и запущу торговлю на Freqtrade. Что интересует — боты, стратегии или обучение?',
      );
    }
  };

  const speakFallbackTts = (text: string) => {
    try {
      const u = new SpeechSynthesisUtterance(cleanText(text));
      u.lang = 'ru-RU';
      u.rate = 1;
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
    } catch {
      /* noop */
    }
  };

  const sendChat = () => {
    const q = chatInput.trim();
    if (!q) return;
    setChatMsgs((m) => [...m, { who: 'user', text: q }]);
    setChatInput('');
    const last = chatMsgs
      .filter((m) => m.text.trim().length > 0)
      .slice(-20)
      .map((m) => ({
        role: m.who === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));
    if (!sendWS(q, last)) {
      const ans = fallback(q);
      setChatMsgs((m) => [...m, { who: 'bot', text: ans }]);
      speakFallbackTts(ans);
    }
  };

  return (
    <div className="min-h-screen bg-[#070B14] text-white selection:bg-violet-500/30" data-v="v13">
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#070B14]/70 backdrop-blur">
        <div className="max-w-[1160px] mx-auto px-5 h-[64px] flex items-center justify-between">
          <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-cyan-400 flex items-center justify-center font-800 text-[13px]">FD</div><span className="font-800 text-[15px] tracking-tight">FreqDash</span></div>
          <div className="hidden lg:flex items-center gap-6 text-[13px] text-white/60"><a href="#features" className="hover:text-white">Возможности</a><a href="#pricing" className="hover:text-white">Тарифы</a></div>
          <div className="flex items-center gap-2"><button onClick={() => { const n = i18n.language?.startsWith('ru') ? 'en' : 'ru'; i18n.changeLanguage(n).catch(()=>{}); }} className="hidden sm:inline px-3 py-1.5 text-xs border border-white/10 rounded-full hover:bg-white/5">{i18n.language?.startsWith('ru') ? 'EN' : 'RU'}</button><Link to="/login" className="bg-white text-[#070B14] rounded-full px-5 py-2.5 text-[13px] font-700">Войти →</Link></div>
        </div>
      </nav>
      <section className="relative overflow-hidden" style={{background:'radial-gradient(600px 400px at 20% 10%, rgba(124,92,255,.25), transparent 60%), radial-gradient(700px 500px at 80% 20%, rgba(59,130,246,.22), transparent 60%), #070B14'}}>
        <div className="max-w-[1160px] mx-auto px-5 pt-10 md:pt-14 pb-10 grid lg:grid-cols-[1.05fr_.95fr] gap-8 items-center">
          <div>
            <h1 className="font-800 leading-[0.92] text-[34px] sm:text-[42px] lg:text-[44px] tracking-tight">Торговые боты<br/><span className="text-white">под контролем</span> <span className="inline-flex items-center bg-white text-ink rounded-full px-3.5 py-1 text-[20px] font-800 ml-1">24/7</span></h1>
            <p className="mt-4 text-[15px] leading-relaxed text-white/65 max-w-[520px]">FreqDash — дашборд для Freqtrade: мультиботы, бэктесты 2–5 лет, риск-контроль и аналитика. Спросите у аватара — покажет всё в чате.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link to="/login" className="bg-white text-[#070B14] rounded-full px-7 py-3.5 text-[14px] font-800">Начать бесплатно</Link><a href="https://t.me/geniok" target="_blank" className="bg-white/10 border border-white/10 rounded-full px-6 py-3.5 text-[14px] font-700">Написать в Telegram</a></div>
            <div className="mt-5 flex flex-wrap gap-2 text-[11px]"><span className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5">Binance</span><span className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5">Bybit</span><span className="bg-white/5 border border-white/10 rounded-full px-3 py-1.5">OKX</span></div>
          </div>
          <div className="relative">
            <div className="rounded-[28px] p-[2px]" style={{background:'conic-gradient(from 0deg,#7C5CFF,#3B82F6,#22D3EE,#7C5CFF)'}}>
              <div className="bg-[#0F1426] rounded-[26px] overflow-hidden relative">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span><span className="text-[12px] font-700">Юпитер — ассистент FreqDash</span><span className="text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 rounded-full px-2 py-0.5">online</span></div>
                </div>
                <div className="relative h-[380px] bg-black overflow-hidden">
                  <iframe id="fdAvatar" src="/avatar/" allow="autoplay; clipboard-write" className="absolute inset-0 w-full border-0" style={{height:'calc(100% + 40px)', transform:'translateY(-36px)'}} loading="eager"></iframe>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none"></div>
                  <button onClick={speak} className="absolute bottom-3 right-3 bg-white text-[#070B14] rounded-full px-3 py-1.5 text-[11px] font-700 shadow-lg hover:scale-105 transition">🔊 Нажми — заговорит</button>
                  <div className="absolute bottom-3 left-3 right-3 space-y-2 max-h-[210px] overflow-y-auto pr-1" id="chatBox">
                    {chatMsgs.map((m,i)=> (
                      <div key={i} className={m.who==='user' ? 'bg-white/10 backdrop-blur border border-white/15 rounded-2xl rounded-br-md px-3.5 py-2.5 text-[12px] leading-snug max-w-[85%] ml-auto text-white' : 'rounded-2xl rounded-bl-md px-3.5 py-2.5 text-[12px] leading-snug max-w-[88%] text-white shadow-lg border'} style={m.who==='bot' ? {background:'rgba(0,0,0,0.14)', backdropFilter:'blur(12px)', WebkitBackdropFilter:'blur(12px)', borderColor:'rgba(255,255,255,0.14)'} : {}}>
                        {m.text}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="p-3 flex items-center gap-2 border-t border-white/5">
                  <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter' && sendChat()} placeholder="Спросите про ботов…" className="flex-1 bg-white/5 border border-white/10 rounded-full px-4 py-2.5 text-[13px] text-white placeholder:text-white/40 outline-none focus:border-violet-500" />
                  <button onClick={sendChat} className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-cyan-400 flex items-center justify-center text-white shrink-0">↑</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="max-w-[1160px] mx-auto px-5 py-10 text-center text-white/50 text-[13px]">Готово к работе — подключите Freqtrade и начните за минуты. <Link to="/login" className="text-white underline">Войти в дашборд →</Link></section>
    </div>
  );
}
