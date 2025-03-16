'use client';

import { useState, useEffect, useRef, ReactElement, useCallback, WheelEvent, MouseEvent, useMemo } from 'react';
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

// 모드 타입 정의 추가
type InteractionMode = 'DRAW' | 'DRAG';

// 픽셀 검색을 위한 해시맵 생성 함수
const createPixelMap = (pixels: Pixel[]) => {
  const map = new Map<string, Pixel>();
  pixels.forEach(pixel => {
    map.set(`${pixel.x}-${pixel.y}`, pixel);
  });
  return map;
};

// 색상 팔레트 정의
const COLOR_PALETTE = [
  '#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', 
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080',
  '#808080', '#A52A2A', '#008080', '#800000', '#008000'
];

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
  // 인터랙션 모드 상태 추가 - 기본값은 그리기 모드
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('DRAW');
  // 스페이스바 누름 상태 추가
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  // UI 컨트롤 표시 여부
  const [showControls, setShowControls] = useState<boolean>(false);
  const [viewport, setViewport] = useState<ViewportState>({
    startX: 0,
    startY: 0,
    endX: 100, 
    endY: 100
  });
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const animationRef = useRef<number | null>(null);
  const targetScaleRef = useRef<number>(1);
  const targetPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // 픽셀 맵 업데이트
  useEffect(() => {
    setPixelMap(createPixelMap(pixels));
  }, [pixels]);

  // 부드러운 애니메이션을 위한 효과
  useEffect(() => {
    const animateTransform = () => {
      let needsUpdate = false;
      
      // 스케일 애니메이션
      if (Math.abs(scale - targetScaleRef.current) > 0.001) {
        const newScale = scale + (targetScaleRef.current - scale) * 0.1;
        setScale(newScale);
        needsUpdate = true;
      }
      
      // 위치 애니메이션
      const dx = targetPositionRef.current.x - position.x;
      const dy = targetPositionRef.current.y - position.y;
      
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
        setPosition({
          x: position.x + dx * 0.1,
          y: position.y + dy * 0.1
        });
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        animationRef.current = requestAnimationFrame(animateTransform);
      } else {
        animationRef.current = null;
      }
    };
    
    if (!animationRef.current) {
      animationRef.current = requestAnimationFrame(animateTransform);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [scale, position]);

  // 화면 크기에 맞게 픽셀 크기 조정 - 100만 픽셀 최적화 버전
  useEffect(() => {
    const updateCanvasSize = () => {
      if (!containerRef.current) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      
      // 화면에 맞게 픽셀 크기 계산 (너무 작지 않게)
      const widthRatio = containerWidth / width;
      const heightRatio = containerHeight / height;
      
      // 화면에 맞게 픽셀 크기 결정 (최소 픽셀 크기 유지)
      const calculatedPixelSize = Math.max(1, Math.min(widthRatio, heightRatio) * 0.8);
      
      setActualPixelSize(calculatedPixelSize);
      
      // 초기 viewport 계산 (성능을 위해 보이는 영역만 렌더링)
      const visibleWidth = Math.ceil(containerWidth / (calculatedPixelSize * scale));
      const visibleHeight = Math.ceil(containerHeight / (calculatedPixelSize * scale));
      
      // 중앙에서 시작하는 뷰포트 계산
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
      const visiblePixelsX = Math.ceil(containerWidth / (actualPixelSize * scale)) + 10; // 여유분 추가
      const visiblePixelsY = Math.ceil(containerHeight / (actualPixelSize * scale)) + 10;
      
      // position 값은 픽셀 단위로 변환
      const centerX = Math.floor(width / 2) + Math.floor(position.x / actualPixelSize);
      const centerY = Math.floor(height / 2) + Math.floor(position.y / actualPixelSize);
      
      const halfVisibleX = Math.floor(visiblePixelsX / 2);
      const halfVisibleY = Math.floor(visiblePixelsY / 2);
      
      // 성능을 위한 최대 영역 제한
      const maxVisibleArea = 400; // 화면에 보여지는 최대 픽셀 수
      
      const newViewport = {
        startX: Math.max(0, centerX - Math.min(halfVisibleX, maxVisibleArea)),
        startY: Math.max(0, centerY - Math.min(halfVisibleY, maxVisibleArea)),
        endX: Math.min(width, centerX + Math.min(halfVisibleX, maxVisibleArea)),
        endY: Math.min(height, centerY + Math.min(halfVisibleY, maxVisibleArea))
      };
      
      // 이전 viewport와 변경이 있을 때만 상태 업데이트 (불필요한 렌더링 방지)
      if (
        newViewport.startX !== viewport.startX ||
        newViewport.startY !== viewport.startY ||
        newViewport.endX !== viewport.endX ||
        newViewport.endY !== viewport.endY
      ) {
        setViewport(newViewport);
      }
    };
    
    updateViewport();
  }, [position, scale, width, height, actualPixelSize, viewport]);

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

  // 마우스 휠 이벤트로 확대/축소 처리 - 부드러운 줌
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    
    // 마우스 포인터 위치 (화면 기준)
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // 확대/축소 스케일 변경 (성능 개선: 천천히 확대/축소)
    // deltaY가 양수면 축소, 음수면 확대
    const direction = e.deltaY > 0 ? -1 : 1;
    
    // 현재 스케일에 따라 줌 계수 조정
    let zoomFactor = 0.1;
    if (scale < 1) zoomFactor = 0.05;
    if (scale > 10) zoomFactor = 0.2;
    
    const newScale = scale + (direction * zoomFactor * scale);
    
    // 스케일 범위 제한 (0.1 ~ 50)
    const limitedScale = Math.max(0.1, Math.min(50, newScale));
    
    // 마우스 위치 기준으로 확대/축소 중심점 설정
    const scaleDiff = limitedScale / scale;
    
    // 마우스 포인터 위치를 기준으로 위치 조정
    const mouseXInWorld = mouseX / scale - position.x;
    const mouseYInWorld = mouseY / scale - position.y;
    
    // 타겟 값 업데이트 (애니메이션이 부드럽게 진행됨)
    targetScaleRef.current = limitedScale;
    targetPositionRef.current = {
      x: position.x - (mouseXInWorld * (scaleDiff - 1)),
      y: position.y - (mouseYInWorld * (scaleDiff - 1))
    };
  }, [scale, position]);

  // 키보드 이벤트 리스너 추가
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 스페이스바가 눌렸을 때 드래그 모드로 전환
      if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault(); // 스크롤 방지
        setIsSpacePressed(true);
        setInteractionMode('DRAG');
      }
      
      // Shift 키를 눌렀을 때도 드래그 모드로 전환
      if (e.shiftKey && !isSpacePressed) {
        setInteractionMode('DRAG');
      }
      
      // H 키를 누르면 컨트롤 표시 토글
      if (e.code === 'KeyH') {
        setShowControls(prev => !prev);
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      // 스페이스바가 떼어졌을 때 그리기 모드로 돌아감
      if (e.code === 'Space') {
        setIsSpacePressed(false);
        setInteractionMode('DRAW');
      }
      
      // Shift 키가 떼어졌을 때 그리기 모드로 돌아감
      if (!e.shiftKey && !isSpacePressed) {
        setInteractionMode('DRAW');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isSpacePressed]);

  // 캔버스 드래그 이동 관련 핸들러 수정
  const handleCanvasMouseDown = useCallback((e: MouseEvent<HTMLDivElement>) => {
    // 우클릭은 항상 드래그 모드로 처리
    if (e.button === 2) {
      e.preventDefault();
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      return;
    }
    
    // 좌클릭인 경우 현재 모드에 따라 처리
    if (e.button === 0) {
      // 드래그 모드이거나 스페이스바/Shift가 눌려있는 경우 드래그 처리
      if (interactionMode === 'DRAG' || isSpacePressed || e.shiftKey) {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      }
      // 그리기 모드일 때는 아무것도 하지 않음 (개별 픽셀 클릭이 처리함)
    }
  }, [interactionMode, isSpacePressed]);

  const handleCanvasMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // 직접 위치 업데이트 (드래그는 즉시 반응해야 함)
    setPosition(prev => ({ 
      x: prev.x + dx / scale, 
      y: prev.y + dy / scale 
    }));
    
    // 타겟 포지션도 함께 업데이트
    targetPositionRef.current = {
      x: position.x + dx / scale,
      y: position.y + dy / scale
    };
    
    setDragStart({ x: e.clientX, y: e.clientY });
  }, [isDragging, dragStart, scale, position]);

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 우클릭 메뉴 방지
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // 픽셀 클릭 핸들러 수정 - 드래그 모드일 때는 색칠하지 않음
  const handlePixelClick = useCallback((x: number, y: number) => {
    if (isDragging || interactionMode === 'DRAG') return; // 드래그 모드일 때는 색칠하지 않음
    
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
  }, [selectedColor, isDragging, interactionMode]);

  // 픽셀 그리드 렌더링 최적화
  const renderPixelGrid = useCallback(() => {
    const grid: ReactElement[] = [];
    const visibleWidth = viewport.endX - viewport.startX;
    const visibleHeight = viewport.endY - viewport.startY;
    
    // 최대 렌더링할 픽셀 수 제한 (성능을 위해)
    const maxRenderPixels = 15000; // 최대 픽셀 수 증가
    
    // 렌더링할 픽셀이 너무 많으면 샘플링하여 렌더링
    const totalVisiblePixels = visibleWidth * visibleHeight;
    let samplingFactor = 1; // 기본값은 모든 픽셀 렌더링
    
    if (totalVisiblePixels > maxRenderPixels) {
      samplingFactor = Math.ceil(Math.sqrt(totalVisiblePixels / maxRenderPixels));
    }
    
    // 스케일이 작을수록 샘플링 비율 증가 (멀리서 볼 때는 덜 정밀하게)
    if (scale < 0.5) {
      samplingFactor = Math.max(samplingFactor, Math.ceil(1 / scale) * 2);
    }
    
    // 가시 영역의 픽셀만 샘플링하여 렌더링
    for (let y = viewport.startY; y < viewport.endY; y += samplingFactor) {
      for (let x = viewport.startX; x < viewport.endX; x += samplingFactor) {
        // 픽셀 색상 결정 (성능 최적화: 그룹 픽셀 색상 결정)
        let pixelColor = '#F8F8F8'; // 기본 배경색 - 좀 더 부드러운 흰색
        
        // 현재 그리드 내의 픽셀이 있는지 확인
        const pixel = pixelMap.get(`${x}-${y}`);
        if (pixel) {
          pixelColor = pixel.color;
        } else if (samplingFactor > 1) {
          // 샘플링 영역 내에 색칠된 픽셀이 있는지 확인
          let hasColoredPixel = false;
          let pixelCheckCount = 0;
          const maxCheckCount = 4; // 최대 4개 픽셀만 확인
          
          for (let sy = y; sy < y + samplingFactor && sy < viewport.endY && pixelCheckCount < maxCheckCount; sy += 2) {
            for (let sx = x; sx < x + samplingFactor && sx < viewport.endX && pixelCheckCount < maxCheckCount; sx += 2) {
              pixelCheckCount++;
              const sampledPixel = pixelMap.get(`${sx}-${sy}`);
              if (sampledPixel) {
                pixelColor = sampledPixel.color;
                hasColoredPixel = true;
                break;
              }
            }
            if (hasColoredPixel) break;
          }
        }
        
        // 샘플링 비율에 맞게 픽셀 크기 조정
        const pixelSize = Math.max(1, actualPixelSize * scale);  // 최소 1px 크기 보장
        const pixelWidth = pixelSize * samplingFactor;
        const pixelHeight = pixelSize * samplingFactor;
        
        // 테두리 스타일 최적화: 스케일이 클 때만 테두리 표시
        const showBorder = scale > 5 && samplingFactor <= 2;
        
        grid.push(
          <div
            key={`${x}-${y}`}
            className="pixel"
            style={{
              width: `${pixelWidth}px`,
              height: `${pixelHeight}px`,
              backgroundColor: pixelColor,
              border: showBorder ? '1px solid #EEEEEE' : 'none',
              position: 'absolute',
              left: `${(x - viewport.startX) * pixelSize}px`,
              top: `${(y - viewport.startY) * pixelSize}px`,
              transform: 'translate3d(0, 0, 0)', // 하드웨어 가속
            }}
            onClick={() => handlePixelClick(x, y)}
          />
        );
      }
    }
    
    return grid;
  }, [pixelMap, viewport, actualPixelSize, handlePixelClick, scale]);

  // 보이는 영역 크기 계산 - 메모이제이션 적용
  const { viewportWidth, viewportHeight, visibleGridWidth, visibleGridHeight } = useMemo(() => {
    const vw = viewport.endX - viewport.startX;
    const vh = viewport.endY - viewport.startY;
    return {
      viewportWidth: vw,
      viewportHeight: vh,
      visibleGridWidth: vw * actualPixelSize,
      visibleGridHeight: vh * actualPixelSize
    };
  }, [viewport, actualPixelSize]);

  // 메모이제이션된 픽셀 그리드 (성능 개선)
  const pixelGrid = useMemo(() => renderPixelGrid(), [renderPixelGrid]);

  // 격자 배경 그리기
  const renderGridBackground = useMemo(() => {
    if (scale < 4) return null; // 줌이 충분히 클 때만 격자 표시
    
    return (
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          backgroundSize: `${actualPixelSize * scale}px ${actualPixelSize * scale}px`,
          backgroundImage: 'linear-gradient(to right, #f0f0f0 1px, transparent 1px), linear-gradient(to bottom, #f0f0f0 1px, transparent 1px)',
          opacity: Math.min((scale - 4) * 0.1, 0.5),
          transform: 'translate3d(0, 0, 0)', // 하드웨어 가속
        }}
      />
    );
  }, [scale, actualPixelSize]);

  // 좌표 표시기 (선택적)
  const renderCoordinateIndicator = useMemo(() => {
    if (!showControls) return null;
    
    const centerX = Math.floor(width / 2 + position.x / actualPixelSize);
    const centerY = Math.floor(height / 2 + position.y / actualPixelSize);
    
    return (
      <div className="fixed bottom-16 left-4 bg-white bg-opacity-70 py-1 px-2 rounded-lg text-xs">
        {centerX}, {centerY}
      </div>
    );
  }, [position, actualPixelSize, width, height, showControls]);

  return (
    <div 
      ref={containerRef} 
      className="w-full h-full overflow-hidden"
    >
      {/* 캔버스 컨테이너 */}
      <div
        ref={canvasContainerRef}
        className="relative w-full h-full"
      >
        {/* 캔버스 그리드 - 가상화 적용 */}
        <div
          ref={canvasRef}
          className="absolute w-full h-full overflow-hidden"
          style={{
            cursor: isDragging ? 'grabbing' : 
                    interactionMode === 'DRAG' ? 'grab' : 'crosshair'
          }}
          onWheel={handleWheel}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
          onContextMenu={handleContextMenu}
        >
          {renderGridBackground}
          <div 
            className="absolute transform-gpu"
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
              willChange: 'transform',
            }}
          >
            {pixelGrid}
          </div>
        </div>
      </div>

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

      {/* 현재 선택된 색상 표시 (미니멀) */}
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
          <p>드래그: 화면 이동</p>
          <p>스페이스바: 일시적 이동 모드</p>
          <p>H: 도움말 표시/숨김</p>
        </div>
      )}
      
      {renderCoordinateIndicator}
    </div>
  );
};

export default PixelCanvas; 