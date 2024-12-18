import { type RefObject } from 'react';

export function useScrollIntoView(
  topRef: RefObject<HTMLDivElement>,
  bottomRef: RefObject<HTMLDivElement>
) {
  const scrollToTop = () => {
    topRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return { scrollToTop, scrollToBottom };
}