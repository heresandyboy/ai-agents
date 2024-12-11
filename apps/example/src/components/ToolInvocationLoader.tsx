import { motion } from 'framer-motion';
import React, { memo } from 'react';

interface ToolInvocationLoaderProps {
  toolName: string;
}

const ToolInvocationLoader: React.FC<ToolInvocationLoaderProps> = ({ toolName }) => {
  // Animation variants for the container
  const containerVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  // Animation variants for the bouncing dots
  const dotVariants = {
    initial: { y: 0 },
    animate: {
      y: [-8, 0, -8],
      transition: {
        duration: 1.2,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className="p-4 rounded-lg bg-gray-100 dark:bg-gray-800/50 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {`Running ${toolName}`}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Please wait while we process your request
          </p>
        </div>
        
        <div className="flex gap-1">
          {[...Array(3)].map((_, index) => (
            <motion.div
              key={index}
              variants={dotVariants}
              className="w-2 h-2 rounded-full bg-spark-purple"
              style={{ 
                originY: 0.5,
                // Stagger the animation of each dot
                transition: { delay: index * 0.1 } 
              }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(ToolInvocationLoader);