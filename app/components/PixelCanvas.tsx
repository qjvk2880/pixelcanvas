'use client';

import { useState, useEffect, useRef, ReactElement, useCallback, WheelEvent, MouseEvent } from 'react';
import { io, Socket } from 'socket.io-client';

interface Pixel {
  x: number;
  y: number;
  color: string;
}

interface PixelCanvasProps {
  width: number;
  height: number;
  pixelSize: number;
}

// 픽셀 검색을 위한 해시맵 생성 함수
const createPixelMap = (pixels: Pixel[]) => {
  const map = new Map<string, Pixel>();
  pixels.forEach(pixel => {
    map.set(`${pixel.x}-${pixel.y}`, pixel);
  });
  return map;
};

const PixelCanvas: React.FC<PixelCanvasProps> = ({ width, height, pixelSize }) => {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [pixelMap, setPixelMap] = useState<Map<string, Pixel>>(new Map());
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [scale, setScale] = useState<number>(1);
  // 초기 위치를 중앙으로 설정
  const [position, setPosition] = useState<{ x: number; y: number }>({ 
    x: 0, 
    y: 0 
  });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  // 가시 영역 상태 추가
  const [viewport, setViewport] = useState<{
    startX: number;
    startY: number;
    endX: number;
    endY: number;
  }>({ startX: 0, startY: 0, endX: 0, endY: 0 });

  // 중앙으로 초기 위치 설정
  useEffect(() => {
    if (canvasRef.current) {
      const centerX = -((width * pixelSize) / 2) + (canvasRef.current.clientWidth / 2);
      const centerY = -((height * pixelSize) / 2) + (canvasRef.current.clientHeight / 2);
      setPosition({ x: centerX / pixelSize, y: centerY / pixelSize });
    }
  }, [width, height, pixelSize]);

  // 픽셀 맵 업데이트
  useEffect(() => {
    setPixelMap(createPixelMap(pixels));
  }, [pixels]);

  // 가시 영역 계산
  useEffect(() => {
    if (!canvasRef.current) return;

    const calculateVisibleCells = () => {
      const { clientWidth, clientHeight } = canvasRef.current!;
      
      // 스케일과 위치를 고려하여 가시 영역 계산
      const scaledPixelSize = pixelSize * scale;
      const visibleStartX = Math.floor(-position.x - (clientWidth / scaledPixelSize / 2));
      const visibleStartY = Math.floor(-position.y - (clientHeight / scaledPixelSize / 2));
      const visibleEndX = Math.ceil(visibleStartX + (clientWidth / scaledPixelSize) + 2);
      const visibleEndY = Math.ceil(visibleStartY + (clientHeight / scaledPixelSize) + 2);

      // 범위 제한
      const boundedStartX = Math.max(0, visibleStartX);
      const boundedStartY = Math.max(0, visibleStartY);
      const boundedEndX = Math.min(width, visibleEndX);
      const boundedEndY = Math.min(height, visibleEndY);

      setViewport({
        startX: boundedStartX,
        startY: boundedStartY,
        endX: boundedEndX,
        endY: boundedEndY
      });
    };

    calculateVisibleCells();

    // 스케일이나 위치가 변경될 때 가시 영역 재계산
    const observer = new ResizeObserver(calculateVisibleCells);
    observer.observe(canvasRef.current);

    return () => observer.disconnect();
  }, [position, scale, width, height, pixelSize]);

  // 소켓 연결 설정 - 개선된 버전
  useEffect(() => {
    // 이미 연결 중이거나 연결되어 있으면 재연결하지 않음
    if (socketRef.current || isConnectingRef.current) return;
    
    isConnectingRef.current = true;
    
    const connectSocket = () => {
      try {
        console.log('소켓 연결 시도 중...');
        
        // 소켓 서버 초기화 API 호출
        fetch('/api/socketio')
          .then(() => {
            console.log('Socket.io 서버 초기화 완료');
            
            // Socket.io 클라이언트 연결
            const socket = io({
              path: '/api/socketio',
              reconnectionAttempts: 10,
              reconnectionDelay: 3000,
              reconnection: true,
              timeout: 20000,
              transports: ['websocket', 'polling'],
              autoConnect: true,
              forceNew: true
            });
            
            socketRef.current = socket;
            
            // 이벤트 리스너 설정
            socket.on('connect', () => {
              console.log('소켓 연결됨:', socket.id);
              isConnectingRef.current = false;
            });
            
            // 초기 픽셀 데이터 수신
            socket.on('initialPixels', (initialPixels: Pixel[]) => {
              console.log('초기 픽셀 데이터 수신:', initialPixels.length);
              setPixels(initialPixels);
            });
            
            // 다른 사용자가 픽셀을 업데이트할 때 이벤트 수신
            socket.on('pixelUpdated', (updatedPixel: Pixel) => {
              setPixels(prevPixels => {
                const pixelIndex = prevPixels.findIndex(
                  p => p.x === updatedPixel.x && p.y === updatedPixel.y
                );
                
                if (pixelIndex !== -1) {
                  // 기존 픽셀 업데이트
                  const newPixels = [...prevPixels];
                  newPixels[pixelIndex] = updatedPixel;
                  return newPixels;
                } else {
                  // 새 픽셀 추가
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
            
            socket.io.on('reconnect', (attemptNumber) => {
              console.log(`재연결 성공 (${attemptNumber}번째 시도)`);
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
    
    // 소켓 연결 시작
    connectSocket();
    
    // 컴포넌트 언마운트 시 소켓 연결 해제
    return () => {
      if (socketRef.current) {
        console.log('소켓 연결 해제 중...');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      isConnectingRef.current = false;
    };
  }, []);

  // 마우스 휠 이벤트로 확대/축소 처리
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // 마우스 포인터 위치
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 확대/축소 스케일 변경 (휠 위로: 확대, 휠 아래로: 축소)
    setScale(prevScale => {
      // deltaY가 양수면 축소, 음수면 확대
      const direction = e.deltaY > 0 ? -1 : 1;
      const zoomFactor = 0.1; // 줌 계수
      const newScale = prevScale + (direction * zoomFactor);
      
      // 스케일 범위 제한 (0.5 ~ 20)
      const limitedScale = Math.max(0.5, Math.min(20, newScale));
      
      // 마우스 포인터 위치에 따른 위치 조정 (줌 중심점 설정)
      if (limitedScale !== prevScale) {
        const scaleDiff = limitedScale / prevScale;
        
        // 마우스 포인터 위치를 기준으로 위치 조정
        setPosition(prev => {
          const mouseXInWorld = mouseX / prevScale - prev.x;
          const mouseYInWorld = mouseY / prevScale - prev.y;
          
          return {
            x: prev.x - (mouseXInWorld * (scaleDiff - 1)),
            y: prev.y - (mouseYInWorld * (scaleDiff - 1))
          };
        });
      }
      
      return limitedScale;
    });
  }, []);

  // 픽셀 클릭 핸들러 - 단일 클릭으로만 색칠
  const handlePixelClick = useCallback((x: number, y: number) => {
    if (isDragging) return; // 드래그 중일 때는 색칠하지 않음
    
    const updatedPixel = { x, y, color: selectedColor };
    
    // 낙관적 UI 업데이트 - 서버 응답 전에 UI 먼저 업데이트
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
    
    // 소켓 연결되었을 때만 서버로 전송
    if (socketRef.current) {
      socketRef.current.emit('updatePixel', updatedPixel);
    } else {
      console.error('소켓이 연결되지 않음');
    }
  }, [selectedColor, isDragging]);

  // 캔버스 드래그 이동 관련 핸들러
  const handleCanvasMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // 마우스 좌클릭(0)은 그리기, 우클릭(2) 또는 중간 버튼(1)은 드래그
    if (e.button === 0) {
      // 좌클릭 시 아무 동작 없음 (픽셀 클릭은 개별 픽셀에서 처리)
      return;
    }
    
    // 우클릭 또는 중간 버튼으로 드래그 시작
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  const handleCanvasMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    setPosition(prev => ({ 
      x: prev.x + dx / scale, 
      y: prev.y + dy / scale 
    }));
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, scale]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 우클릭 메뉴 방지
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // 픽셀 그리드 렌더링 - 가시 영역만 렌더링하는 최적화 버전
  const renderPixelGrid = useCallback(() => {
    const grid: ReactElement[] = [];
    
    // 가시 영역의 픽셀만 렌더링
    for (let y = viewport.startY; y < viewport.endY; y++) {
      for (let x = viewport.startX; x < viewport.endX; x++) {
        // Map을 사용하여 O(1) 시간 복잡도로 픽셀 찾기
        const pixel = pixelMap.get(`${x}-${y}`);
        const pixelColor = pixel ? pixel.color : '#FFFFFF';
        
        grid.push(
          <div
            key={`${x}-${y}`}
            className="pixel"
            style={{
              width: `${pixelSize}px`,
              height: `${pixelSize}px`,
              backgroundColor: pixelColor,
              border: pixelSize > 3 ? '1px solid #EEEEEE' : 'none', // 픽셀이 작을 때는 테두리 제거
              position: 'absolute',
              left: `${x * pixelSize}px`,
              top: `${y * pixelSize}px`
            }}
            onClick={() => handlePixelClick(x, y)}
          />
        );
      }
    }
    
    return grid;
  }, [pixelMap, viewport, pixelSize, handlePixelClick]);

  // 색상 선택 팔레트
  const colorPalette = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#808080', '#A52A2A', '#008080', '#800000', '#008000'
  ];

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div
        ref={canvasRef}
        className="w-full h-full overflow-hidden cursor-crosshair"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      >
        <div
          className="absolute"
          style={{
            width: `${width * pixelSize}px`,
            height: `${height * pixelSize}px`,
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          {renderPixelGrid()}
        </div>
      </div>

      {/* 플로팅 색상 선택 팔레트 */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2 p-3 bg-white bg-opacity-90 rounded-full shadow-lg border border-gray-200 z-10">
        {colorPalette.map(color => (
          <div
            key={color}
            className={`w-8 h-8 rounded-full cursor-pointer border-2 transition-transform hover:scale-110 ${
              selectedColor === color ? 'border-gray-800 scale-110' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setSelectedColor(color)}
          />
        ))}
      </div>

      {/* 현재 선택된 색상 표시 */}
      <div className="fixed bottom-20 right-6 flex flex-col items-center bg-white bg-opacity-80 p-2 rounded-lg shadow-md">
        <span className="text-xs mb-1">선택된 색상</span>
        <div 
          className="w-10 h-10 rounded-full border-2 border-gray-800"
          style={{ backgroundColor: selectedColor }}
        />
      </div>
      
      {/* 사용법 안내 */}
      <div className="fixed top-4 left-4 bg-white bg-opacity-80 p-2 rounded-lg shadow-md text-xs z-10">
        <p>마우스 휠: 확대/축소</p>
        <p>마우스 우클릭 & 드래그: 화면 이동</p>
        <p>클릭: 픽셀 색칠</p>
      </div>
      
      {/* 현재 좌표 및 크기 표시 */}
      <div className="fixed top-4 right-4 bg-white bg-opacity-80 p-2 rounded-lg shadow-md text-xs z-10">
        <p>캔버스 크기: {width}x{height} ({width * height} 픽셀)</p>
        <p>확대/축소: {Math.round(scale * 100)}%</p>
        <p>가시 영역: {viewport.endX - viewport.startX}x{viewport.endY - viewport.startY} 픽셀</p>
      </div>
    </div>
  );
};

export default PixelCanvas; 