import React from 'react';
import * as RadixTooltip from '@radix-ui/react-tooltip';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
}

const Tooltip: React.FC<TooltipProps> = ({ content, children }) => (
  <RadixTooltip.Provider delayDuration={200}>
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side="top"
          align="center"
          className="bg-gray-800 text-white px-2 py-1 rounded shadow-lg text-sm z-50"
        >
          {content}
          <RadixTooltip.Arrow className="fill-current text-gray-800" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  </RadixTooltip.Provider>
);

export default Tooltip;