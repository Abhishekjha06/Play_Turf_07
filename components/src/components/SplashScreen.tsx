import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SplashScreenProps {
  onComplete?: () => void;
}

const SPLASH_DURATION = 3000;
const EXIT_DURATION = 420;
const LOGO_SRC = '/playturf-logo.webp';

const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsVisible(false);
      onCompleteRef.current?.();
    }, SPLASH_DURATION + EXIT_DURATION);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className={cn('fixed inset-0 z-50 overflow-hidden bg-black', isVisible ? 'block' : 'hidden')}
      aria-label="PlayTurf loading"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.42, ease: 'easeOut' }}
    >
      <div className="absolute inset-0 bg-black" />
      <div className="lux-exposure" />
      <div className="lux-haze lux-haze-a" />
      <div className="lux-haze lux-haze-b" />
      <div className="lux-rays" />
      <div className="lux-grid" />
      <div className="lux-grid-pulse lux-grid-pulse-a" />
      <div className="lux-grid-pulse lux-grid-pulse-b" />

      <div className="lux-dust" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="lux-flow" aria-hidden="true">
        <span className="lux-flow-line lux-flow-line-a" />
        <span className="lux-flow-line lux-flow-line-b" />
        <span className="lux-flow-line lux-flow-line-c" />
        <span className="lux-flow-line lux-flow-line-d" />
      </div>

      <motion.div
        className="lux-camera absolute inset-0 flex items-center justify-center px-8"
        initial={{ scale: 0.965, y: 10 }}
        animate={{ scale: [0.965, 1.008, 1], y: [10, 0, 0] }}
        transition={{ duration: 3, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          className="lux-logo-stage relative w-[clamp(170px,48vw,240px)]"
          initial={{
            opacity: 0,
            scale: 0.94,
            filter: 'blur(18px) brightness(0.78)',
            clipPath: 'inset(46% 18% 46% 18% round 24px)',
          }}
          animate={{
            opacity: [0, 0.28, 0.86, 1],
            scale: [0.94, 0.985, 1.006, 1],
            filter: [
              'blur(18px) brightness(0.78)',
              'blur(10px) brightness(0.92)',
              'blur(2px) brightness(1.03)',
              'blur(0px) brightness(1)',
            ],
            clipPath: [
              'inset(46% 18% 46% 18% round 24px)',
              'inset(30% 10% 30% 10% round 20px)',
              'inset(6% 0% 6% 0% round 14px)',
              'inset(0% 0% 0% 0% round 0px)',
            ],
          }}
          transition={{ duration: 2.46, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.img
            src={LOGO_SRC}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-auto w-full select-none blur-2xl"
            draggable={false}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: [0, 0.2, 0.12], scale: [0.98, 1.05, 1.02] }}
            transition={{ duration: 2.7, delay: 0.52, ease: 'easeOut' }}
          />

          <motion.img
            src={LOGO_SRC}
            alt="PlayTurf"
            className="lux-logo relative z-10 block h-auto w-full select-none"
            draggable={false}
          />

          <motion.div
            className="lux-ceramic-sheen"
            initial={{ opacity: 0, x: '-82%' }}
            animate={{ opacity: [0, 0.34, 0], x: ['-82%', '10%', '92%'] }}
            transition={{ duration: 1.18, delay: 1.78, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="lux-glass-refraction"
            initial={{ opacity: 0, x: '-58%' }}
            animate={{ opacity: [0, 0.26, 0], x: ['-58%', '18%', '72%'] }}
            transition={{ duration: 1.05, delay: 1.38, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="lux-final-sweep"
            initial={{ opacity: 0, x: '-92%' }}
            animate={{ opacity: [0, 0.42, 0], x: ['-92%', '6%', '96%'] }}
            transition={{ duration: 0.82, delay: 2.26, ease: [0.16, 1, 0.3, 1] }}
          />
          <motion.div
            className="lux-scan-shimmer"
            initial={{ opacity: 0, y: '-24%' }}
            animate={{ opacity: [0, 0.2, 0], y: ['-24%', '58%', '118%'] }}
            transition={{ duration: 1.08, delay: 1.18, ease: 'easeOut' }}
          />
          <motion.span
            className="lux-corner lux-corner-tl"
            initial={{ opacity: 0, x: -12, y: -12 }}
            animate={{ opacity: [0, 0.42, 0.24], x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 1.48, ease: 'easeOut' }}
          />
          <motion.span
            className="lux-corner lux-corner-br"
            initial={{ opacity: 0, x: 12, y: 12 }}
            animate={{ opacity: [0, 0.42, 0.24], x: 0, y: 0 }}
            transition={{ duration: 0.7, delay: 1.48, ease: 'easeOut' }}
          />
        </motion.div>
      </motion.div>

      <div className="lux-vignette" />

      <style>{`
        .lux-exposure {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 45%, rgba(167, 255, 0, 0.075), transparent 0 24%, transparent 46%),
            radial-gradient(circle at 50% 52%, rgba(255, 255, 255, 0.045), transparent 0 18%, transparent 36%);
          animation: lux-exposure-adapt 3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .lux-haze {
          position: absolute;
          left: 50%;
          top: 50%;
          width: min(88vw, 460px);
          aspect-ratio: 1.45;
          pointer-events: none;
          border-radius: 999px;
          mix-blend-mode: screen;
          transform: translate(-50%, -50%);
          background: radial-gradient(ellipse at center, rgba(167, 255, 0, 0.07), rgba(34, 197, 94, 0.035) 34%, transparent 68%);
          filter: blur(34px);
          opacity: 0;
          animation: lux-haze-drift 3s ease-out forwards;
        }

        .lux-haze-b {
          width: min(68vw, 350px);
          top: 57%;
          background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.055), rgba(167, 255, 0, 0.022) 42%, transparent 70%);
          filter: blur(42px);
          animation-delay: 0.14s;
        }

        .lux-rays {
          position: absolute;
          inset: -12% -28%;
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: 0;
          background:
            linear-gradient(103deg, transparent 0 32%, rgba(255, 255, 255, 0.05) 39%, transparent 47%),
            linear-gradient(77deg, transparent 0 56%, rgba(167, 255, 0, 0.052) 62%, transparent 69%);
          filter: blur(18px);
          animation: lux-rays 3s ease-out forwards;
        }

        .lux-grid {
          position: absolute;
          inset: auto -28% -20% -28%;
          height: 42%;
          pointer-events: none;
          transform-origin: bottom center;
          transform: perspective(660px) rotateX(69deg) translateY(18%);
          opacity: 0;
          background-image:
            linear-gradient(rgba(167, 255, 0, 0.105) 1px, transparent 1px),
            linear-gradient(90deg, rgba(167, 255, 0, 0.07) 1px, transparent 1px);
          background-size: 54px 54px;
          mask-image: linear-gradient(to top, rgba(0, 0, 0, 0.92), transparent 74%);
          animation: lux-grid-rise 3s ease-out forwards;
        }

        .lux-grid-pulse {
          position: absolute;
          left: 50%;
          bottom: 9%;
          width: min(58vw, 310px);
          height: 1px;
          pointer-events: none;
          opacity: 0;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(167, 255, 0, 0.38), rgba(255, 255, 255, 0.18), rgba(167, 255, 0, 0.38), transparent);
          filter: blur(1px) drop-shadow(0 0 14px rgba(167, 255, 0, 0.22));
          transform: translateX(-50%) perspective(620px) rotateX(70deg) scaleX(0.2);
          animation: lux-grid-pulse 1.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .lux-grid-pulse-a { animation-delay: 0.88s; }
        .lux-grid-pulse-b { bottom: 15%; width: min(42vw, 230px); animation-delay: 1.74s; }

        .lux-dust {
          position: absolute;
          inset: 0;
          pointer-events: none;
          mix-blend-mode: screen;
          opacity: 0.34;
        }

        .lux-dust span {
          position: absolute;
          width: 1.5px;
          height: 1.5px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.42);
          box-shadow: 0 0 8px rgba(167, 255, 0, 0.18);
          animation: lux-dust 3s linear forwards;
        }

        .lux-dust span:nth-child(1) { left: 18%; top: 34%; animation-delay: 0.2s; }
        .lux-dust span:nth-child(2) { left: 76%; top: 28%; animation-delay: 0.45s; transform: scale(0.75); }
        .lux-dust span:nth-child(3) { left: 33%; top: 66%; animation-delay: 0.72s; transform: scale(0.62); }
        .lux-dust span:nth-child(4) { left: 84%; top: 61%; animation-delay: 0.98s; transform: scale(0.82); }
        .lux-dust span:nth-child(5) { left: 11%; top: 72%; animation-delay: 1.2s; transform: scale(0.68); }
        .lux-dust span:nth-child(6) { left: 58%; top: 22%; animation-delay: 1.45s; transform: scale(0.58); }

        .lux-flow {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          mix-blend-mode: screen;
        }

        .lux-flow-line {
          position: absolute;
          left: -40%;
          width: 34%;
          height: 1px;
          border-radius: 999px;
          opacity: 0;
          background: linear-gradient(90deg, transparent, rgba(167, 255, 0, 0.06), rgba(255, 255, 255, 0.32), rgba(167, 255, 0, 0.22), transparent);
          filter: blur(0.35px) drop-shadow(0 0 8px rgba(167, 255, 0, 0.22));
          transform: skewX(-17deg);
          animation: lux-flow-sweep 1.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        .lux-flow-line-a { top: 35%; animation-delay: 0.72s; }
        .lux-flow-line-b { top: 48%; width: 42%; animation-delay: 1.08s; }
        .lux-flow-line-c { top: 63%; animation-delay: 1.58s; }
        .lux-flow-line-d { top: 55%; width: 28%; animation-delay: 2.02s; }

        .lux-logo-stage {
          transform-style: preserve-3d;
        }

        .lux-logo {
          filter:
            contrast(1.055)
            saturate(1.04)
            drop-shadow(0 0 8px rgba(255, 255, 255, 0.08))
            drop-shadow(0 0 18px rgba(167, 255, 0, 0.16))
            drop-shadow(0 0 38px rgba(167, 255, 0, 0.08));
          animation: lux-logo-settle 3s ease-out forwards;
        }

        .lux-ceramic-sheen,
        .lux-glass-refraction,
        .lux-final-sweep {
          position: absolute;
          inset: 0;
          z-index: 18;
          pointer-events: none;
          mix-blend-mode: screen;
          border-radius: 16px;
        }

        .lux-ceramic-sheen {
          width: 38%;
          background: linear-gradient(104deg, transparent 0%, rgba(255, 255, 255, 0.035) 22%, rgba(255, 255, 255, 0.38) 48%, rgba(255, 255, 255, 0.06) 62%, transparent 84%);
          filter: blur(9px);
          transform: skewX(-13deg);
        }

        .lux-glass-refraction {
          inset: 7% 2%;
          width: 42%;
          background: linear-gradient(112deg, transparent 0%, rgba(167, 255, 0, 0.035) 25%, rgba(167, 255, 0, 0.24) 47%, rgba(255, 255, 255, 0.1) 56%, transparent 78%);
          filter: blur(8px);
          transform: skewX(-16deg);
        }

        .lux-final-sweep {
          width: 30%;
          background: linear-gradient(100deg, transparent 0%, rgba(255, 255, 255, 0.02) 24%, rgba(255, 255, 255, 0.52) 50%, rgba(167, 255, 0, 0.12) 58%, transparent 80%);
          filter: blur(6px);
          transform: skewX(-14deg);
        }

        .lux-scan-shimmer {
          position: absolute;
          inset: 0;
          z-index: 19;
          pointer-events: none;
          mix-blend-mode: screen;
          height: 26%;
          background:
            repeating-linear-gradient(
              180deg,
              transparent 0,
              transparent 5px,
              rgba(255, 255, 255, 0.1) 6px,
              rgba(167, 255, 0, 0.06) 7px,
              transparent 9px
            );
          filter: blur(0.35px);
        }

        .lux-corner {
          position: absolute;
          z-index: 22;
          width: 28px;
          height: 28px;
          pointer-events: none;
          border-color: rgba(167, 255, 0, 0.5);
          filter: drop-shadow(0 0 8px rgba(167, 255, 0, 0.28));
        }

        .lux-corner-tl {
          left: -8px;
          top: -8px;
          border-left: 1px solid;
          border-top: 1px solid;
        }

        .lux-corner-br {
          right: -8px;
          bottom: -8px;
          border-right: 1px solid;
          border-bottom: 1px solid;
        }

        .lux-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(circle at 50% 43%, transparent 0 20%, rgba(0, 0, 0, 0.44) 55%, rgba(0, 0, 0, 0.98) 100%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.018), transparent 18%, transparent 76%, rgba(167, 255, 0, 0.018));
        }

        @keyframes lux-exposure-adapt {
          0% { opacity: 0; transform: scale(0.94); }
          52% { opacity: 1; }
          100% { opacity: 0.62; transform: scale(1.025); }
        }

        @keyframes lux-haze-drift {
          0% { opacity: 0; transform: translate(-52%, -48%) scale(0.9); }
          45% { opacity: 0.92; }
          100% { opacity: 0.36; transform: translate(-50%, -52%) scale(1.06); }
        }

        @keyframes lux-rays {
          0% { opacity: 0; transform: translate3d(-4%, 1%, 0) scale(0.98); }
          50% { opacity: 0.62; }
          100% { opacity: 0.22; transform: translate3d(3%, -1%, 0) scale(1.02); }
        }

        @keyframes lux-grid-rise {
          0% { opacity: 0; background-position: 0 40px, 0 0; transform: perspective(660px) rotateX(69deg) translateY(24%); }
          50% { opacity: 0.18; }
          100% { opacity: 0.08; background-position: 0 -28px, 20px 0; transform: perspective(660px) rotateX(69deg) translateY(11%); }
        }

        @keyframes lux-grid-pulse {
          0% { opacity: 0; transform: translateX(-50%) perspective(620px) rotateX(70deg) scaleX(0.12) translateY(18px); }
          32% { opacity: 0.42; }
          100% { opacity: 0; transform: translateX(-50%) perspective(620px) rotateX(70deg) scaleX(1.1) translateY(-32px); }
        }

        @keyframes lux-dust {
          0% { opacity: 0; transform: translate3d(0, 14px, 0); }
          34% { opacity: 0.48; }
          100% { opacity: 0; transform: translate3d(14px, -34px, 0); }
        }

        @keyframes lux-flow-sweep {
          0% { opacity: 0; transform: translateX(0) skewX(-17deg) scaleX(0.54) translateY(0); }
          20% { opacity: 0.52; }
          62% { transform: translateX(210%) skewX(-12deg) scaleX(1.06) translateY(-4px); }
          100% { opacity: 0; transform: translateX(330%) skewX(-17deg) scaleX(1.04) translateY(0); }
        }

        @keyframes lux-logo-settle {
          0%, 68% { transform: translate3d(0, 0, 0); }
          74% { transform: translate3d(0.4px, -0.15px, 0); }
          76% { filter: saturate(1.04) contrast(1.06); }
          80%, 100% { transform: translate3d(0, 0, 0); }
        }

        @media (max-width: 390px) {
          .lux-logo-stage {
            width: clamp(125px, 36vw, 165px);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .lux-haze,
          .lux-rays,
          .lux-grid,
          .lux-grid-pulse,
          .lux-dust,
          .lux-flow {
            display: none;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default SplashScreen;
