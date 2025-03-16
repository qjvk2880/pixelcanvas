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
  pixelSize?: number; // 선택적 매개변수로 변경
}

interface ViewportState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
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
  // 실제 사용할 픽셀 크기 (화면 크기에 따라 동적으로 조정됨)
  const [actualPixelSize, setActualPixelSize] = useState<number>(pixelSize || 1); // 기본값을 1픽셀로 설정
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [pixelMap, setPixelMap] = useState<Map<string, Pixel>>(new Map());
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState<ViewportState>({
    startX: 0,
    startY: 0,
    endX: 100, // 초기에 화면에 보이는 픽셀 수 제한
    endY: 100
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  // 픽셀 맵 업데이트
  useEffect(() => {
    setPixelMap(createPixelMap(pixels));
  }, [pixels]);

  // 화면 크기에 맞게 픽셀 크기 조정 - 100만 픽셀 최적화 버전
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 100만 픽셀을 고려하면 픽셀 크기는 매우 작아야 함
      // 기본 픽셀 크기를 계산하고 scale로 확대/축소하는 방식으로 변경
      
      // 최소 픽셀 크기 설정 (너무 작으면 클릭하기 어려움)
      const minPixelSize = 1;
      
      // 화면에 표시될 픽셀 수를 제한
      const newPixelSize = minPixelSize;
      
      console.log(`화면 크기: ${containerWidth}x${containerHeight}, 픽셀 크기: ${newPixelSize}px`);
      
      setActualPixelSize(newPixelSize);
      
      // 초기 viewport 계산 (성능을 위해 보이는 영역만 렌더링)
      const visibleWidth = Math.ceil(containerWidth / (newPixelSize * scale));
      const visibleHeight = Math.ceil(containerHeight / (newPixelSize * scale));
      
      // 스크롤 위치에 따라 보이는 영역 계산
      const centerX = Math.floor(width / 2);
      const centerY = Math.floor(height / 2);
      
      const halfVisibleWidth = Math.floor(visibleWidth / 2);
      const halfVisibleHeight = Math.floor(visibleHeight / 2);
      
      setViewport({
        startX: Math.max(0, centerX - halfVisibleWidth),
        startY: Math.max(0, centerY - halfVisibleHeight),
        endX: Math.min(width, centerX + halfVisibleWidth),
        endY: Math.min(height, centerY + halfVisibleHeight)
      });
    };
    
    // 초기 로드 및 창 크기 변경 시 크기 업데이트
    updateCanvasSize();
    
    const handleResize = () => {
      updateCanvasSize();
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [width, height, scale]);

  // 가시 영역 계산 (스크롤/줌 변경 시)
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const updateViewport = () => {
      const container = canvasRef.current!;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 현재 화면에 보이는 픽셀 범위 계산
      const visiblePixelsX = Math.ceil(containerWidth / (actualPixelSize * scale)) + 4; // 여유분 추가
      const visiblePixelsY = Math.ceil(containerHeight / (actualPixelSize * scale)) + 4;
      
      // position 값은 픽셀 단위로 변환
      const centerX = Math.floor(width / 2) + Math.floor(position.x / actualPixelSize);
      const centerY = Math.floor(height / 2) + Math.floor(position.y / actualPixelSize);
      
      const halfVisibleX = Math.floor(visiblePixelsX / 2);
      const halfVisibleY = Math.floor(visiblePixelsY / 2);
      
      const newViewport = {
        startX: Math.max(0, centerX - halfVisibleX),
        startY: Math.max(0, centerY - halfVisibleY),
        endX: Math.min(width, centerX + halfVisibleX),
        endY: Math.min(height, centerY + halfVisibleY)
      };
      
      setViewport(newViewport);
    };
    
    updateViewport();
  }, [position, scale, width, height, actualPixelSize]);

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

  // 마우스 휠 이벤트로 확대/축소 처리 - 100만 픽셀 최적화 버전
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // 마우스 포인터 위치 (화면 기준)
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
      
      // 스케일 범위 제한 (0.1 ~ 50) - 100만 픽셀은 더 확대 가능하도록
      const limitedScale = Math.max(0.1, Math.min(50, newScale));
      
      // 마우스 위치 기준으로 확대/축소 (줌 중심점 설정)
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

  // 픽셀 그리드 렌더링 - 가상화 적용 (화면에 보이는 픽셀만 렌더링)
  const renderPixelGrid = useCallback(() => {
    const grid: ReactElement[] = [];
    const visibleWidth = viewport.endX - viewport.startX;
    const visibleHeight = viewport.endY - viewport.startY;
    
    // 최대 렌더링할 픽셀 수 제한 (성능을 위해)
    const maxRenderPixels = 10000; // 최대 1만개만 렌더링
    
    // 렌더링할 픽셀이 너무 많으면 샘플링하여 렌더링
    const totalVisiblePixels = visibleWidth * visibleHeight;
    let samplingFactor = 1; // 기본값은 모든 픽셀 렌더링
    
    if (totalVisiblePixels > maxRenderPixels) {
      samplingFactor = Math.ceil(Math.sqrt(totalVisiblePixels / maxRenderPixels));
    }
    
    console.log(`보이는 픽셀: ${totalVisiblePixels}, 샘플링 비율: ${samplingFactor}, 실제 렌더링: ${Math.floor(totalVisiblePixels / (samplingFactor * samplingFactor))}`);
    
    // 가시 영역의 픽셀만 샘플링하여 렌더링
    for (let y = viewport.startY; y < viewport.endY; y += samplingFactor) {
      for (let x = viewport.startX; x < viewport.endX; x += samplingFactor) {
        // Map을 사용하여 O(1) 시간 복잡도로 픽셀 찾기
        const pixel = pixelMap.get(`${x}-${y}`);
        const pixelColor = pixel ? pixel.color : '#FFFFFF';
        
        // 샘플링 비율에 맞게 픽셀 크기 조정
        const pixelWidth = actualPixelSize * samplingFactor;
        const pixelHeight = actualPixelSize * samplingFactor;
        
        grid.push(
          <div
            key={`${x}-${y}`}
            className="pixel"
            style={{
              width: `${pixelWidth}px`,
              height: `${pixelHeight}px`,
              backgroundColor: pixelColor,
              border: samplingFactor <= 4 ? '1px solid #EEEEEE' : 'none', // 픽셀이 충분히 클 때만 테두리 표시
              position: 'absolute',
              left: `${(x - viewport.startX) * actualPixelSize}px`,
              top: `${(y - viewport.startY) * actualPixelSize}px`,
            }}
            onClick={() => handlePixelClick(x, y)}
          />
        );
      }
    }
    
    return grid;
  }, [pixelMap, viewport, actualPixelSize, handlePixelClick]);

  // 색상 선택 팔레트
  const colorPalette = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
    '#808080', '#A52A2A', '#008080', '#800000', '#008000'
  ];

  // 보이는 영역 크기 계산
  const viewportWidth = viewport.endX - viewport.startX;
  const viewportHeight = viewport.endY - viewport.startY;
  
  // 보이는 영역의 그리드 크기
  const visibleGridWidth = viewportWidth * actualPixelSize;
  const visibleGridHeight = viewportHeight * actualPixelSize;

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full flex items-center justify-center"
    >
      {/* 캔버스 그리드 - 가상화 적용 */}
      <div
        ref={canvasRef}
        className="overflow-hidden relative"
        style={{
          width: '100%',
          height: '100%',
          cursor: isDragging ? 'grabbing' : 'crosshair'
        }}
        onWheel={handleWheel}
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
        onContextMenu={handleContextMenu}
      >
        <div 
          className="absolute"
          style={{
            width: `${visibleGridWidth}px`,
            height: `${visibleGridHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'center',
            position: 'absolute',
            left: '50%',
            top: '50%',
            marginLeft: `-${visibleGridWidth / 2}px`,
            marginTop: `-${visibleGridHeight / 2}px`,
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
        <p>픽셀 크기: {actualPixelSize}px</p>
        <p>확대/축소: {Math.round(scale * 100)}%</p>
        <p>보이는 영역: {viewport.startX},{viewport.startY} ~ {viewport.endX},{viewport.endY}</p>
      </div>
    </div>
  );
};

export default PixelCanvas; 