// The kommun chats on the website: the same Chattar list and chat rooms as in the app
// (native/NativeChats, native/NativeChatRoom), in a column under the site's header.
import type { ReactNode } from 'react';
import Header from '@/components/Header';
import NativeChatRoom from '@/native/NativeChatRoom';
import NativeChats from '@/native/NativeChats';

const Frame = ({ children, scroll = false }: { children: ReactNode; scroll?: boolean }) => (
  <div className="flex h-[100dvh] flex-col bg-background">
    <Header />
    <main className="ca-dark flex min-h-0 flex-1 justify-center bg-black text-white">
      <div className={`flex min-h-0 w-full max-w-2xl flex-col sm:border-x sm:border-white/[0.08] ${scroll ? 'overflow-y-auto' : ''}`}>
        {children}
      </div>
    </main>
  </div>
);

export const WebChatList = () => <Frame scroll><NativeChats /></Frame>;

export const WebChatRoom = () => <Frame><div className="flex min-h-0 flex-1 flex-col pt-3"><NativeChatRoom /></div></Frame>;
