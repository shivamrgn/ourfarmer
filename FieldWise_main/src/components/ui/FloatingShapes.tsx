import { motion } from 'framer-motion';

export function FloatingShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Large circle */}
      <motion.div
        className="absolute w-64 h-64 rounded-full border-2 border-white/20"
        style={{ top: '10%', left: '10%' }}
        animate={{
          y: [0, -20, 0],
          rotate: [0, 180, 360],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      {/* Hexagon shape */}
      <motion.div
        className="absolute w-32 h-32"
        style={{ top: '60%', left: '60%' }}
        animate={{
          y: [0, 30, 0],
          x: [0, -20, 0],
          rotate: [0, -90, 0],
        }}
        transition={{
          duration: 15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon
            points="50,5 95,27.5 95,72.5 50,95 5,72.5 5,27.5"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="2"
          />
        </svg>
      </motion.div>

      {/* Small triangles */}
      <motion.div
        className="absolute w-16 h-16"
        style={{ top: '30%', right: '20%' }}
        animate={{
          y: [0, -15, 0],
          rotate: [0, 360],
        }}
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <polygon
            points="50,10 90,90 10,90"
            fill="rgba(255,255,255,0.1)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
          />
        </svg>
      </motion.div>

      {/* Dots pattern */}
      <motion.div
        className="absolute"
        style={{ bottom: '20%', left: '25%' }}
        animate={{
          opacity: [0.3, 0.6, 0.3],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-white/30"
            />
          ))}
        </div>
      </motion.div>

      {/* Leaf shape for agriculture theme */}
      <motion.div
        className="absolute w-20 h-20"
        style={{ top: '75%', left: '15%' }}
        animate={{
          y: [0, -10, 0],
          rotate: [-10, 10, -10],
        }}
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          <path
            d="M50,10 Q80,30 80,60 Q80,90 50,90 Q20,90 20,60 Q20,30 50,10"
            fill="rgba(255,255,255,0.08)"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="2"
          />
          <path
            d="M50,20 L50,80 M50,40 Q60,35 65,40 M50,55 Q40,50 35,55"
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
          />
        </svg>
      </motion.div>
    </div>
  );
}
