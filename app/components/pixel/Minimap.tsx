'use client';

import { useMemo } from 'react';
import { Pixel, Position, ViewportState } from '../../types/pixel';

interface MinimapProps {
  width: number;
  height: number;
  pixels: Pixel[];
  viewport: ViewportState;
  position: Position;
  scale: number;
  onMinimapClick: (x: number, y: number) => void;
  onClose: () => void;
}

const Minimap: React.FC<MinimapProps> = ({
  width,
  height,
  pixels,
  viewport,
  position,
  scale,
  onMinimapClick,
  onClose
}) => {
  // 효율적인 렌더링을 위해 미니맵에 표시할 픽셀 제한
  const visiblePixels = useMemo(() => {
    if (pixels.length > 2000) {
      const sampleRate = Math.ceil(pixels.length / 2000);
      return pixels.filter((_, index) => index % sampleRate === 0);
    }
    return pixels;
  }, [pixels]);
  
  // 미니맵 클릭 핸들러
  const handleMinimapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const minimapRect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - minimapRect.left;
    const clickY = e.clientY - minimapRect.top;
    
    // 미니맵 내에서의 비율 계산 (0 ~ 1 사이의 값)
    const ratioX = clickX / minimapRect.width;
    const ratioY = clickY / minimapRect.height;
    
    // 클릭 지점의 그리드 좌표 계산
    const gridX = Math.floor(ratioX * width);
    const gridY = Math.floor(ratioY * height);
    
    console.log('미니맵 클릭:', { ratioX, ratioY, gridX, gridY });
    
    onMinimapClick(gridX, gridY);
  };
  
  return (
    <div 
      className="fixed bottom-24 right-4 bg-white rounded-lg shadow-lg overflow-hidden z-10 border border-gray-300" 
      style={{ width: 150, height: 150 }}
    >
      {/* 미니맵 배경 */}
      <div 
        className="relative w-full h-full bg-gray-100"
        onClick={handleMinimapClick}
      >
        {/* 색칠된 픽셀들 표시 */}
        {visiblePixels.map((pixel) => {
          const minimapPixelSize = 150 / Math.max(width, height);
          return (
            <div
              key={`minimap-${pixel.x}-${pixel.y}`}
              className="absolute"
              style={{
                left: `${pixel.x * minimapPixelSize}px`,
                top: `${pixel.y * minimapPixelSize}px`,
                width: `${minimapPixelSize}px`,
                height: `${minimapPixelSize}px`,
                backgroundColor: pixel.color,
                transform: minimapPixelSize < 0.5 ? 'scale(2)' : 'none',
                zIndex: 1
              }}
            />
          );
        })}
        
        {/* 뷰포트 영역 표시 */}
        <div
          className="absolute border-2 border-yellow-400 pointer-events-none"
          style={{
            left: `${viewport.startX * (150 / Math.max(width, height))}px`,
            top: `${viewport.startY * (150 / Math.max(width, height))}px`,
            width: `${(viewport.endX - viewport.startX) * (150 / Math.max(width, height))}px`,
            height: `${(viewport.endY - viewport.startY) * (150 / Math.max(width, height))}px`,
            transition: 'all 0.15s ease-out',
            zIndex: 2,
            boxShadow: '0 0 0 1px rgba(255, 255, 255, 0.3)'
          }}
        />
        
        {/* 미니맵 토글 버튼 */}
        <div 
          className="absolute top-1 right-1 w-5 h-5 bg-white bg-opacity-70 rounded-full flex items-center justify-center cursor-pointer text-xs shadow-sm"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ✕
        </div>
      </div>
    </div>
  );
};

export default Minimap; 