'use client';

import { useState, useEffect, useRef, ReactElement } from 'react';
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

const PixelCanvas: React.FC<PixelCanvasProps> = ({ width, height, pixelSize }) => {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>('#000000');
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // 소켓 연결 설정
  useEffect(() => {
    // 이미 연결되어 있으면 재연결하지 않음
    if (socketRef.current) return;
    
    let retryCount = 0;
    const maxRetries = 3;
    
    const connectSocket = () => {
      try {
        console.log('소켓 연결 시도 중...');
        
        // 소켓 서버 초기화 API 호출
        fetch('/api/socketio')
          .then(() => {
            console.log('Socket.io 서버 초기화 완료');
            
            // Socket.io 클라이언트 연결
            const socket = io({
              path: '/api/socketio', // 경로가 pages/api/socketio.ts와 일치하는지 확인
              reconnectionAttempts: 5,
              reconnectionDelay: 1000,
              reconnection: true,
              transports: ['websocket', 'polling'],
              addTrailingSlash: false,
            });
            
            socketRef.current = socket;
            
            // 이벤트 리스너 설정
            socket.on('connect', () => {
              console.log('소켓 연결됨:', socket.id);
              retryCount = 0; // 연결 성공 시 재시도 카운트 초기화
            });
            
            // 초기 픽셀 데이터 수신
            socket.on('initialPixels', (initialPixels: Pixel[]) => {
              console.log('초기 픽셀 데이터 수신:', initialPixels);
              setPixels(initialPixels);
            });
            
            // 다른 사용자가 픽셀을 업데이트할 때 이벤트 수신
            socket.on('pixelUpdated', (updatedPixel: Pixel) => {
              console.log('픽셀 업데이트 수신:', updatedPixel);
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
            
            socket.on('reconnect', (attemptNumber) => {
              console.log(`재연결 성공 (${attemptNumber}번째 시도)`);
            });
            
            socket.on('reconnect_attempt', (attemptNumber) => {
              console.log(`재연결 시도 중... (${attemptNumber}번째 시도)`);
            });
            
            socket.on('reconnect_error', (error) => {
              console.error('재연결 오류:', error);
            });
            
            socket.on('connect_error', (err) => {
              console.error('소켓 연결 오류:', err.message);
              
              // 연결 실패 시 재시도
              if (retryCount < maxRetries) {
                retryCount++;
                console.log(`연결 재시도 (${retryCount}/${maxRetries})...`);
                setTimeout(connectSocket, 2000); // 2초 후 재시도
              }
            });
          })
          .catch(err => {
            console.error('소켓 서버 초기화 API 호출 오류:', err);
            
            // API 호출 실패 시 재시도
            if (retryCount < maxRetries) {
              retryCount++;
              console.log(`API 호출 재시도 (${retryCount}/${maxRetries})...`);
              setTimeout(connectSocket, 2000); // 2초 후 재시도
            }
          });
      } catch (error) {
        console.error('소켓 초기화 오류:', error);
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
    };
  }, []);

  // 픽셀 클릭 핸들러
  const handlePixelClick = (x: number, y: number) => {
    if (!socketRef.current) {
      console.error('소켓이 연결되지 않음');
      return;
    }

    const updatedPixel = { x, y, color: selectedColor };
    console.log('픽셀 업데이트 전송:', updatedPixel);
    
    // 서버에 픽셀 업데이트 이벤트 전송
    socketRef.current.emit('updatePixel', updatedPixel);
  };

  // 마우스 이벤트 핸들러 (드래그로 그리기)
  const handleMouseDown = (x: number, y: number) => {
    setIsDrawing(true);
    handlePixelClick(x, y);
  };

  const handleMouseMove = (x: number, y: number) => {
    if (!isDrawing) return;
    handlePixelClick(x, y);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  // 확대/축소 핸들러
  const handleZoom = (zoomIn: boolean) => {
    setScale(prevScale => {
      const newScale = zoomIn ? prevScale + 0.1 : prevScale - 0.1;
      return Math.max(0.5, Math.min(3, newScale)); // 스케일 범위 제한
    });
  };

  // 픽셀 그리드 렌더링
  const renderPixelGrid = () => {
    const grid: ReactElement[] = [];
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = pixels.find(p => p.x === x && p.y === y);
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
  };

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