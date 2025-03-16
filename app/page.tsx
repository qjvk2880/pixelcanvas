import dynamic from 'next/dynamic';

// 클라이언트 사이드에서만 렌더링하기 위해 동적으로 임포트
const PixelCanvas = dynamic(() => import('./components/PixelCanvas'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-[70vh]">로딩 중...</div>
});

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-4 md:p-12">
      <h1 className="text-4xl font-bold mb-8">협업 픽셀 아트</h1>
      <p className="text-lg mb-8">실시간으로 캔버스에 픽셀을 찍어보세요! 다른 사용자들과 함께 작품을 만들어보세요.</p>
      
      <PixelCanvas width={32} height={32} pixelSize={16} />
      
      <footer className="mt-8 text-sm text-gray-600">
        <p>Next.js, Socket.io, MongoDB로 제작된 실시간 협업 픽셀 아트 애플리케이션</p>
      </footer>
    </main>
  );
}
