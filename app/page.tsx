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
      {/* 픽셀 크기 지정 없이 캔버스를 화면에 꽉 차게 표시 */}
      <PixelCanvas width={32} height={32} />
    </main>
  );
}
