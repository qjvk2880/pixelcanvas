'use client';

import { useState, useEffect, useRef, ReactElement, useCallback } from 'react';
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
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  // 픽셀 맵 업데이트
  useEffect(() => {
    setPixelMap(createPixelMap(pixels));
  }, [pixels]);

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

  // 픽셀 클릭 핸들러 - 낙관적 UI 업데이트 적용
  const handlePixelClick = useCallback((x: number, y: number) => {
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
  }, [selectedColor]);

  // 마우스 이벤트 핸들러 (드래그로 그리기)
  const handleMouseDown = useCallback((x: number, y: number) => {
    setIsDrawing(true);
    handlePixelClick(x, y);
  }, [handlePixelClick]);

  const handleMouseMove = useCallback((x: number, y: number) => {
    if (!isDrawing) return;
    handlePixelClick(x, y);
  }, [isDrawing, handlePixelClick]);

  const handleMouseUp = useCallback(() => {
    setIsDrawing(false);
  }, []);

  // 확대/축소 핸들러
  const handleZoom = useCallback((zoomIn: boolean) => {
    setScale(prevScale => {
      const newScale = zoomIn ? prevScale + 0.1 : prevScale - 0.1;
      return Math.max(0.5, Math.min(3, newScale)); // 스케일 범위 제한
    });
  }, []);

  // 픽셀 그리드 렌더링 - 최적화
  const renderPixelGrid = useCallback(() => {
    const grid: ReactElement[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
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
              border: '1px solid #EEEEEE'
            }}
            onMouseDown={() => handleMouseDown(x, y)}
            onMouseMove={() => handleMouseMove(x, y)}
            onMouseUp={handleMouseUp}
          />
        );
      }
    }
    
    return grid;
  }, [pixelMap, width, height, pixelSize, handleMouseDown, handleMouseMove, handleMouseUp]);

  // 색상 선택 팔레트
  const colorPalette = [
    '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
    '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => handleZoom(true)}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          확대 +
        </button>
        <button
          onClick={() => handleZoom(false)}
          className="px-3 py-1 bg-blue-500 text-white rounded"
        >
          축소 -
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        {colorPalette.map(color => (
          <div
            key={color}
            className={`w-8 h-8 rounded-full cursor-pointer border-2 ${
              selectedColor === color ? 'border-gray-800' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => setSelectedColor(color)}
          />
        ))}
      </div>

      <div
        ref={canvasRef}
        className="overflow-auto border border-gray-300 cursor-pointer"
        style={{
          width: '80vw',
          height: '70vh',
        }}
      >
        <div
          className="grid"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, ${pixelSize}px)`,
            transform: `scale(${scale}) translate(${position.x}px, ${position.y}px)`,
            transformOrigin: 'top left',
          }}
          onMouseLeave={handleMouseUp}
        >
          {renderPixelGrid()}
        </div>
      </div>
    </div>
  );
};

export default PixelCanvas; 