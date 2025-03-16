'use client';

import { useState, useEffect, useRef, useCallback, MouseEvent, WheelEvent, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';

interface Pixel {
  x: number;
  y: number;
  color: string;
}

interface PixelCanvasProps {
  width: number;
  height: number;
  pixelSize?: number;
}

// 색상 팔레트 정의
const COLOR_PALETTE = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#808080', '#A52A2A', '#008080', '#800000', '#008000'
];

const PixelCanvas: React.FC<PixelCanvasProps> = ({ width, height, pixelSize = 1 }) => {
  // 상태 관리
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [pixelMap, setPixelMap] = useState<Map<string, string>>(new Map());
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: -(width / 2), y: -(height / 2) });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lastMousePos, setLastMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showControls, setShowControls] = useState<boolean>(false);
  const [hoverCoord, setHoverCoord] = useState<{ x: number, y: number } | null>(null);
  
  // 참조
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  
  // 픽셀맵 생성 (빠른 조회를 위한 해시맵)
  useEffect(() => {
    const map = new Map<string, string>();
    pixels.forEach(pixel => {
      map.set(`${pixel.x},${pixel.y}`, pixel.color);
    });
    setPixelMap(map);
  }, [pixels]);

  // 캔버스 초기화 및 그리기 함수
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // 캔버스 크기 설정 및 초기화
    const rect = containerRef.current?.getBoundingClientRect() || canvas.getBoundingClientRect();
    const cssWidth = rect.width;
    const cssHeight = rect.height;
    
    // 고해상도 디스플레이 지원
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    
    // 컨텍스트 스케일 설정
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 변환 초기화
    ctx.scale(dpr, dpr);
    
    // 배경 그리기
    ctx.fillStyle = '#F8F8F8';
    ctx.fillRect(0, 0, cssWidth, cssHeight);
    
    // 픽셀 크기 계산
    const basePixelSize = Math.min(cssWidth / width, cssHeight / height) * 0.9;
    const pixelSize = basePixelSize * scale;
    
    // 중앙점 및 오프셋 계산
    const centerX = cssWidth / 2;
    const centerY = cssHeight / 2;
    const offsetX = centerX + position.x * scale;
    const offsetY = centerY + position.y * scale;
    
    // 표시 영역 계산
    const startX = Math.floor((0 - offsetX) / pixelSize);
    const startY = Math.floor((0 - offsetY) / pixelSize);
    const endX = Math.ceil((cssWidth - offsetX) / pixelSize);
    const endY = Math.ceil((cssHeight - offsetY) / pixelSize);
    
    // 격자 그리기 (확대 수준이 높을 때만)
    if (scale > 2) {
      ctx.strokeStyle = '#EEEEEE';
      ctx.lineWidth = 0.5;
      
      for (let x = Math.max(0, startX); x < Math.min(width, endX); x++) {
        for (let y = Math.max(0, startY); y < Math.min(height, endY); y++) {
          const screenX = offsetX + x * pixelSize;
          const screenY = offsetY + y * pixelSize;
          ctx.strokeRect(screenX, screenY, pixelSize, pixelSize);
        }
      }
    }
    
    // 색칠된 픽셀 그리기
    for (let x = Math.max(0, startX); x < Math.min(width, endX); x++) {
      for (let y = Math.max(0, startY); y < Math.min(height, endY); y++) {
        const key = `${x},${y}`;
        const color = pixelMap.get(key);
        
        if (color) {
          const screenX = offsetX + x * pixelSize;
          const screenY = offsetY + y * pixelSize;
          
          ctx.fillStyle = color;
          ctx.fillRect(screenX, screenY, pixelSize, pixelSize);
        }
      }
    }
    
    // 호버 효과
    if (hoverCoord && scale > 0.3) {
      const { x, y } = hoverCoord;
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const key = `${x},${y}`;
        if (!pixelMap.has(key)) {
          const screenX = offsetX + x * pixelSize;
          const screenY = offsetY + y * pixelSize;
          
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = selectedColor;
          ctx.fillRect(screenX, screenY, pixelSize, pixelSize);
          ctx.globalAlpha = 1.0;
        }
      }
    }
  }, [width, height, position, scale, pixelMap, hoverCoord, selectedColor]);
  
  // 그리기 함수 실행 (애니메이션 프레임 없이)
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);
  
  // 창 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      drawCanvas();
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [drawCanvas]);
  
  // 소켓 연결 설정
  useEffect(() => {
    if (socketRef.current || isConnectingRef.current) return;
    
    isConnectingRef.current = true;
    
    const connectSocket = () => {
      try {
        console.log('소켓 연결 시도 중...');
        
        fetch('/api/socketio')
          .then(() => {
            console.log('Socket.io 서버 초기화 완료');
            
            const socket = io({
              path: '/api/socketio',
              reconnectionAttempts: 10,
              reconnectionDelay: 3000,
              reconnection: true,
              timeout: 20000,
              transports: ['websocket', 'polling']
            });
            
            socketRef.current = socket;
            
            socket.on('connect', () => {
              console.log('소켓 연결됨:', socket.id);
              isConnectingRef.current = false;
            });
            
            socket.on('initialPixels', (initialPixels: Pixel[]) => {
              console.log('초기 픽셀 데이터 수신:', initialPixels.length);
              setPixels(initialPixels);
            });
            
            socket.on('pixelUpdated', (updatedPixel: Pixel) => {
              setPixels(prevPixels => {
                const pixelIndex = prevPixels.findIndex(
                  p => p.x === updatedPixel.x && p.y === updatedPixel.y
                );
                
                if (pixelIndex !== -1) {
                  const newPixels = [...prevPixels];
                  newPixels[pixelIndex] = updatedPixel;
                  return newPixels;
                } else {
                  return [...prevPixels, updatedPixel];
                }
              });
            });
            
            socket.on('disconnect', () => {
              console.log('소켓 연결 해제됨');
            });
            
            socket.io.on('error', (error) => {
              console.error('소켓 IO 오류:', error);
            });
          })
          .catch(err => {
            console.error('소켓 서버 초기화 API 호출 오류:', err);
            isConnectingRef.current = false;
          });
      } catch (error) {
        console.error('소켓 초기화 오류:', error);
        isConnectingRef.current = false;
      }
    };
    
    connectSocket();
    
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, []);
  
  // 캔버스 초기화 시 중앙으로 위치 조정
  useEffect(() => {
    // 캔버스 초기화 후 그리드 중앙이 화면 중앙에 오도록 position 설정
    setPosition({ x: -(width / 2), y: -(height / 2) });
    console.log('캔버스 초기화: 중앙으로 위치 조정됨', { width, height });
  }, [width, height]);
  
  // 그리드 좌표 계산 함수
  const getGridCoordinates = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: -1, y: -1 };
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    
    // 픽셀 크기 계산
    const basePixelSize = Math.min(rect.width / width, rect.height / height) * 0.9;
    const pixelSize = basePixelSize * scale;
    
    // 중앙점 및 오프셋 계산
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const offsetX = centerX + position.x * scale;
    const offsetY = centerY + position.y * scale;
    
    // 그리드 좌표 계산
    const gridX = Math.floor((canvasX - offsetX) / pixelSize);
    const gridY = Math.floor((canvasY - offsetY) / pixelSize);
    
    return { x: gridX, y: gridY };
  }, [width, height, scale, position]);
  
  // 마우스 이벤트 핸들러
  const handleMouseDown = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (e.button === 0) {
      // 좌클릭 - 픽셀 색상 변경
      const coords = getGridCoordinates(e.clientX, e.clientY);
      const { x, y } = coords;
      
      if (x >= 0 && x < width && y >= 0 && y < height) {
        const updatedPixel = { x, y, color: selectedColor };
        
        // 낙관적 UI 업데이트
        setPixels(prevPixels => {
          const pixelIndex = prevPixels.findIndex(p => p.x === x && p.y === y);
          
          if (pixelIndex !== -1) {
            const newPixels = [...prevPixels];
            newPixels[pixelIndex] = updatedPixel;
            return newPixels;
          } else {
            return [...prevPixels, updatedPixel];
          }
        });
        
        // 서버로 업데이트 전송
        if (socketRef.current) {
          socketRef.current.emit('updatePixel', updatedPixel);
        }
      }
    } else if (e.button === 2) {
      // 우클릭 - 드래그 시작
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [getGridCoordinates, selectedColor, width, height]);
  
  const handleMouseMove = useCallback((e: MouseEvent<HTMLCanvasElement>) => {
    // 호버 좌표 업데이트
    const coords = getGridCoordinates(e.clientX, e.clientY);
    setHoverCoord(coords);
    
    // 드래그 처리
    if (isDragging) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      
      setPosition(prev => ({
        x: prev.x + dx / scale,
        y: prev.y + dy / scale
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  }, [getGridCoordinates, isDragging, lastMousePos, scale]);
  
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);
  
  // 마우스 휠 이벤트 처리
  const handleWheel = useCallback((e: WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    // 마우스 위치에서의 확대/축소
    const { clientX, clientY } = e;
    const coords = getGridCoordinates(clientX, clientY);
    
    // 확대/축소 계수
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(50, scale * zoomFactor));
    
    // 마우스 위치를 기준으로 확대/축소
    if (scale !== newScale) {
      const zoomRatio = newScale / scale;
      
      // 마우스 위치를 기준으로 오프셋 조정
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const mouseX = clientX - rect.left;
        const mouseY = clientY - rect.top;
        
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        
        // 마우스 위치에서의 상대 위치
        const relX = mouseX - centerX - position.x * scale;
        const relY = mouseY - centerY - position.y * scale;
        
        // 새 위치 계산
        setPosition({
          x: position.x - relX * (1 / scale - 1 / newScale),
          y: position.y - relY * (1 / scale - 1 / newScale)
        });
      }
      
      setScale(newScale);
    }
  }, [scale, position, getGridCoordinates]);
  
  // 컨텍스트 메뉴 방지
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);
  
  // 키보드 이벤트 처리
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // H 키를 누르면 도움말 표시/숨김
      if (e.code === 'KeyH') {
        setShowControls(prev => !prev);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // 좌표 표시기
  const coordinateIndicator = useMemo(() => {
    if (!showControls || !hoverCoord) return null;
    
    return (
      <div className="fixed bottom-16 left-4 bg-white bg-opacity-70 py-1 px-2 rounded-lg text-xs">
        {hoverCoord.x}, {hoverCoord.y}
      </div>
    );
  }, [showControls, hoverCoord]);

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
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
      
      {/* 플로팅 색상 선택 팔레트 */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1 p-2 bg-white bg-opacity-90 rounded-full shadow-lg z-10">
        {COLOR_PALETTE.map(color => (
          <div
            key={color}
            className={`w-7 h-7 rounded-full cursor-pointer border transition-transform hover:scale-110 ${
              selectedColor === color ? 'border-gray-800 scale-110 shadow-md' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setSelectedColor(color)}
          />
        ))}
      </div>

      {/* 현재 선택된 색상 표시 */}
      <div 
        className="fixed bottom-16 right-4 w-6 h-6 rounded-full border-2 border-white shadow-md"
        style={{ backgroundColor: selectedColor }}
      />
      
      {/* 도움말 토글 버튼 */}
      <div 
        className="fixed top-4 right-4 w-8 h-8 bg-white bg-opacity-70 rounded-full flex items-center justify-center cursor-pointer shadow-md"
        onClick={() => setShowControls(prev => !prev)}
      >
        <span className="text-gray-600 text-sm font-bold">?</span>
      </div>
      
      {/* 사용법 안내 (토글 가능) */}
      {showControls && (
        <div className="fixed top-14 right-4 bg-white bg-opacity-80 p-2 rounded-lg shadow-md text-xs z-10 max-w-[200px]">
          <p>마우스 휠: 확대/축소</p>
          <p>좌클릭: 픽셀 색칠</p>
          <p>우클릭 + 드래그: 화면 이동</p>
          <p>H: 도움말 표시/숨김</p>
          <p className="mt-1 text-gray-500">배율: {Math.round(scale * 100)}%</p>
        </div>
      )}
      
      {coordinateIndicator}
    </div>
  );
};

export default PixelCanvas;