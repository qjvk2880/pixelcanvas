'use client';

import dynamic from 'next/dynamic';

// 클라이언트 사이드에서만 렌더링하기 위해 동적으로 임포트
const PixelCanvas = dynamic(() => import('./components/PixelCanvas'), {
  ssr: false,
  loading: () => <div className="flex justify-center items-center h-screen">로딩 중...</div>
});

export default function Home() {
  return (
    <main className="h-screen w-screen overflow-hidden p-0 m-0">
      {/* 32 x 32 = 1,024개의 픽셀 */}
      <PixelCanvas width={32} height={32} pixelSize={16} />
    </main>
  );
}
