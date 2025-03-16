'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Pixel, PixelCanvasProps, PixelMap, ViewportState } from '../types/pixel';
import { usePixelSocket } from '../hooks/usePixelSocket';
import { useCanvasControls } from '../hooks/useCanvasControls';
import { useCanvasRenderer } from '../hooks/useCanvasRenderer';
import Minimap from './pixel/Minimap';
import ColorPalette from './pixel/ColorPalette';
import ControlPanel from './pixel/ControlPanel';
import NicknameModal from './pixel/NicknameModal';
import UsersList from './pixel/UsersList';

const PixelCanvas: React.FC<PixelCanvasProps> = ({ width, height, pixelSize = 1 }) => {
  // 상태 관리
  const [pixelMap, setPixelMap] = useState<PixelMap>(new Map());
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [hoverCoord, setHoverCoord] = useState<{ x: number, y: number } | null>(null);
  const [showControls, setShowControls] = useState<boolean>(false);
  const [showMinimap, setShowMinimap] = useState<boolean>(true);
  const [userId] = useState<string>(`user-${Math.random().toString(36).substring(2, 9)}`);
  const [nickname, setNickname] = useState<string>('');
  
  // 참조
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 사용자 정의 훅
  const {
    pixels,
    animatedPixels,
    users,
    isConnected,
    initialLoadComplete,
    updatePixel,
    registerUser
  } = usePixelSocket({ 
    userId,
    nickname: nickname || undefined 
  });
  
  const {
    scale,
    position,
    isDragging,
    viewport,
    setScale,
    setPosition,
    startDragging,
    stopDragging,
    handleDrag,
    handleZoom,
    moveToPosition,
    getGridCoordinates
  } = useCanvasControls({ 
    width, 
    height, 
    initialScale: 15 
  });
  
  const { drawCanvas } = useCanvasRenderer({
    canvasRef,
    containerRef,
    pixels,
    pixelMap,
    animatedPixels,
    width,
    height,
    scale,
    position,
    viewport,
    selectedColor,
    hoverCoord
  });
  
  // 닉네임 로드
  useEffect(() => {
    console.log('닉네임 로드 시도 중...');
    if (typeof window !== 'undefined') {
      // 디버깅용 초기화 코드
      // localStorage.removeItem('pixel-art-nickname');
      
      const savedNickname = localStorage.getItem('pixel-art-nickname');
      console.log('저장된 닉네임:', savedNickname);
      
      if (savedNickname) {
        setNickname(savedNickname);
      }
    }
  }, []);
  
  // 닉네임 제출 핸들러
  const handleNicknameSubmit = useCallback((newNickname: string) => {
    setNickname(newNickname);
    registerUser(newNickname);
  }, [registerUser]);
  
  // 픽셀맵 생성 (빠른 조회를 위한 해시맵)
  useEffect(() => {
    const map = new Map<string, string>();
    pixels.forEach(pixel => {
      map.set(`${pixel.x},${pixel.y}`, pixel.color);
    });
    setPixelMap(map);
  }, [pixels]);
  
  // 초기 데이터 로딩 완료 후 화면 중앙 이동
  useEffect(() => {
    if (initialLoadComplete) {
      // 중앙 좌표로 이동
      const centerX = width / 2;
      const centerY = height / 2;
      setPosition({ x: -centerX, y: -centerY });
      
      console.log('초기 데이터 로딩 완료: 화면 중앙으로 이동 완료', { centerX, centerY, currentScale: scale });
    }
  }, [initialLoadComplete, width, height, scale, setPosition]);
  
  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // H 키를 누르면 도움말 표시/숨김
      if (e.code === 'KeyH') {
        setShowControls(prev => !prev);
      }
      
      // M 키를 누르면 미니맵 표시/숨김
      if (e.code === 'KeyM') {
        setShowMinimap(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // 마우스 이벤트 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    if (e.button === 0) {
      // 좌클릭 - 픽셀 색상 변경
      const coords = getGridCoordinates(e.clientX, e.clientY, containerRect);
      const { x, y } = coords;
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        updatePixel({ x, y, color: selectedColor });
      }
    } else if (e.button === 2) {
      // 우클릭 - 드래그 시작
      startDragging(e.clientX, e.clientY);
    }
  }, [getGridCoordinates, selectedColor, width, height, startDragging, updatePixel]);
  
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    // 호버 좌표 업데이트
    const coords = getGridCoordinates(e.clientX, e.clientY, containerRect);
    setHoverCoord(coords);
    
    // 드래그 처리
    handleDrag(e.clientX, e.clientY);
  }, [getGridCoordinates, handleDrag]);
  
  // 휠 이벤트 처리
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    handleZoom(e.deltaY, e.clientX, e.clientY, containerRect);
  }, [handleZoom]);
  
  // 미니맵 클릭 처리
  const handleMinimapClick = useCallback((gridX: number, gridY: number) => {
    moveToPosition({ x: -gridX, y: -gridY });
  }, [moveToPosition]);
  
  return (
    <div 
      ref={containerRef} 
      className="w-screen h-screen overflow-hidden absolute inset-0"
    >
      <canvas
        ref={canvasRef}
        className="touch-none select-none w-full h-full"
        style={{
          cursor: isDragging ? 'grabbing' : 'crosshair',
          display: 'block' // 인라인 요소 간격 방지
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDragging}
        onMouseLeave={stopDragging}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* 색상 팔레트 */}
      <ColorPalette 
        selectedColor={selectedColor}
        onColorSelect={setSelectedColor}
      />
      
      {/* 컨트롤 패널 */}
      <ControlPanel
        showControls={showControls}
        onToggleControls={() => setShowControls(prev => !prev)}
        onToggleMinimap={() => setShowMinimap(prev => !prev)}
        scale={scale}
        showMinimap={showMinimap}
        hoverCoord={hoverCoord}
      />
      
      {/* 미니맵 */}
      {showMinimap && (
        <Minimap
          width={width}
          height={height}
          pixels={pixels}
          viewport={viewport}
          position={position}
          scale={scale}
          onMinimapClick={handleMinimapClick}
          onClose={() => setShowMinimap(false)}
        />
      )}
      
      {/* 닉네임 모달 */}
      <NicknameModal 
        onSubmit={handleNicknameSubmit}
        savedNickname={nickname}
      />
      
      {/* 사용자 목록 */}
      {isConnected && nickname && (
        <UsersList 
          users={users}
          currentUserId={userId}
        />
      )}
    </div>
  );
};

export default PixelCanvas;