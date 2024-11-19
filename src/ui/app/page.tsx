import ChatWindow from '@/components/ChatWindow';
import Sidebar from '@/components/Sidebar';

export default function Home() {
  return (
    <div className="flex h-full">
      <Sidebar />
      <main className="flex-1 ml-64">
        <div className="max-w-4xl mx-auto">
          <ChatWindow />
        </div>
      </main>
    </div>
  );
}