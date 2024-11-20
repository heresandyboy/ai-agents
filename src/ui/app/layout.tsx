import '@/styles/globals.css';
import { Inter } from 'next/font/google';
import NavBar from '@/components/NavBar';
import { CustomThemeProvider } from '@/components/ThemeProvider';

const inter = Inter({ subsets: ['latin'] });

const LIGHT_THEME_COLOR = 'hsl(0 0% 100%)'; // Adjust to match your light theme background
const DARK_THEME_COLOR = 'hsl(222.2 84% 4.9%)'; // Adjust to match your dark theme background

const THEME_COLOR_SCRIPT = `
(function() {
  var html = document.documentElement;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    document.head.appendChild(meta);
  }
  function updateThemeColor() {
    var isDark = html.classList.contains('dark');
    meta.setAttribute('content', isDark ? '${DARK_THEME_COLOR}' : '${LIGHT_THEME_COLOR}');
  }
  var observer = new MutationObserver(updateThemeColor);
  observer.observe(html, { attributes: true, attributeFilter: ['class'] });
  updateThemeColor();
})();
`;

export const metadata = {
  title: 'AI Agents Chat',
  description: 'Interactive AI Agents with tool usage capabilities',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: THEME_COLOR_SCRIPT,
          }}
        />
      </head>
      <body className={`${inter.className} h-screen antialiased`}>
        <CustomThemeProvider>
          <NavBar />
          {children}
        </CustomThemeProvider>
      </body>
    </html>
  );
}